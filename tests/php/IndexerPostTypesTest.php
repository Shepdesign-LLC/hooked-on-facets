<?php
/**
 * @package HookedOnFacets\Tests
 */

declare(strict_types=1);

namespace HookedOnFacets\Tests;

use Brain\Monkey;
use Brain\Monkey\Functions;
use HookedOnFacets\Indexer;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use PHPUnit\Framework\TestCase;

/**
 * The indexer's post types come from the admin's choice, then the developer
 * filter. A newly enabled type is indexed by a scoped job that never
 * truncates; a disabled one loses only its own rows.
 */
final class IndexerPostTypesTest extends TestCase {
    use MockeryPHPUnitIntegration;

    /** @var array<string, mixed> */
    private array $options = [];

    /** @var list<string> */
    private array $sql = [];

    protected function setUp(): void {
        parent::setUp();
        Monkey\setUp();
        $this->options = [];
        $this->sql     = [];

        Functions\when( 'get_option' )->alias( fn( $name, $default = false ) => $this->options[ $name ] ?? $default );
        Functions\when( 'update_option' )->alias( function ( $name, $value ) {
            $this->options[ $name ] = $value;
            return true;
        } );
        Functions\when( 'apply_filters' )->alias( static fn( $hook, $value ) => $value );
    }

    protected function tearDown(): void {
        unset( $GLOBALS['wpdb'] );
        Monkey\tearDown();
        parent::tearDown();
    }

    private function wpdb( int $total ): void {
        $wpdb         = Mockery::mock();
        $wpdb->prefix = 'wp_';
        $wpdb->posts  = 'wp_posts';
        $wpdb->shouldReceive( 'prepare' )->andReturnUsing( function ( $sql, ...$args ) {
            $this->sql[] = $sql;
            return $sql;
        } );
        $wpdb->shouldReceive( 'get_var' )->andReturn( (string) $total );
        $wpdb->shouldReceive( 'query' )->andReturnUsing( function ( $sql ) {
            $this->sql[] = $sql;
            return 1;
        } );
        $GLOBALS['wpdb'] = $wpdb;
    }

    // ── which types are indexed ──────────────────────────────────────────

    public function test_defaults_are_post_page_and_product(): void {
        self::assertSame( [ 'post', 'page', 'product' ], Indexer::configured_post_types() );
    }

    public function test_the_admins_choice_replaces_the_defaults(): void {
        $this->options[ Indexer::OPTION_POST_TYPES ] = [ 'product', 'guide' ];

        self::assertSame( [ 'product', 'guide' ], Indexer::configured_post_types() );
        self::assertSame( [ 'product', 'guide' ], ( new Indexer() )->indexed_post_types() );
    }

    public function test_the_developer_filter_still_has_the_last_word(): void {
        $this->options[ Indexer::OPTION_POST_TYPES ] = [ 'product' ];
        Functions\when( 'apply_filters' )->alias( static fn( $hook, $value ) => array_merge( $value, [ 'dealer' ] ) );

        self::assertSame( [ 'product', 'dealer' ], Indexer::configured_post_types() );
        self::assertSame( [ 'product' ], Indexer::saved_post_types(), 'The saved choice is unaffected.' );
    }

    public function test_duplicates_and_blanks_in_the_saved_option_are_ignored(): void {
        $this->options[ Indexer::OPTION_POST_TYPES ] = [ 'product', '', 'product', 'post' ];

        self::assertSame( [ 'product', 'post' ], Indexer::saved_post_types() );
    }

    public function test_a_non_array_option_falls_back_to_the_defaults(): void {
        $this->options[ Indexer::OPTION_POST_TYPES ] = 'garbage';

        self::assertSame( Indexer::DEFAULT_POST_TYPES, Indexer::saved_post_types() );
    }

    // ── the scoped job ───────────────────────────────────────────────────

    public function test_queueing_a_type_never_truncates_the_index(): void {
        $this->wpdb( 84 );
        Functions\when( 'wp_generate_uuid4' )->justReturn( 'job-1' );
        Functions\when( 'wp_clear_scheduled_hook' )->justReturn( true );
        Functions\when( 'wp_schedule_single_event' )->justReturn( true );

        $job = ( new Indexer() )->queue_reindex_types( [ 'guide' ] );

        foreach ( $this->sql as $sql ) {
            self::assertStringNotContainsString( 'TRUNCATE', $sql );
            self::assertStringNotContainsString( 'DELETE', $sql );
        }
        self::assertSame( 84, $job['total'] );
        self::assertSame( [ 'guide' ], $job['types'] );
    }

    public function test_the_job_records_its_types_so_the_chunks_stay_scoped(): void {
        $this->wpdb( 84 );
        Functions\when( 'wp_generate_uuid4' )->justReturn( 'job-1' );
        Functions\when( 'wp_clear_scheduled_hook' )->justReturn( true );
        Functions\when( 'wp_schedule_single_event' )->justReturn( true );

        ( new Indexer() )->queue_reindex_types( [ 'guide' ] );
        $state = $this->options[ Indexer::BACKGROUND_STATE_OPTION ];

        self::assertSame( [ 'guide' ], $state['types'] );
        self::assertTrue( $state['running'] );
        self::assertSame( 'job-1', $state['job_id'] );
        self::assertSame( 1, $state['chunks'] );
    }

    public function test_a_type_with_no_content_finishes_immediately(): void {
        $this->wpdb( 0 );
        Functions\when( 'wp_generate_uuid4' )->justReturn( 'job-1' );
        Functions\when( 'wp_clear_scheduled_hook' )->justReturn( true );

        ( new Indexer() )->queue_reindex_types( [ 'dealer' ] );
        $state = $this->options[ Indexer::BACKGROUND_STATE_OPTION ];

        self::assertFalse( $state['running'] );
        self::assertNotNull( $state['finished_at'] );
    }

    public function test_it_will_not_start_over_a_running_job(): void {
        $this->wpdb( 84 );
        $this->options[ Indexer::BACKGROUND_STATE_OPTION ] = [ 'running' => true, 'job_id' => 'other' ];

        self::assertNull( ( new Indexer() )->queue_reindex_types( [ 'guide' ] ) );
        self::assertSame( 'other', $this->options[ Indexer::BACKGROUND_STATE_OPTION ]['job_id'], 'The running job is left alone.' );
    }

    public function test_it_ignores_an_empty_list(): void {
        $this->wpdb( 0 );

        self::assertNull( ( new Indexer() )->queue_reindex_types( [] ) );
        self::assertNull( ( new Indexer() )->queue_reindex_types( [ '' ] ) );
    }

    // ── switching one off ────────────────────────────────────────────────

    public function test_removing_a_type_deletes_only_that_types_rows(): void {
        $this->wpdb( 0 );

        ( new Indexer() )->delete_post_type_rows( 'guide' );

        $deletes = array_values( array_filter( $this->sql, static fn( $q ) => str_contains( $q, 'DELETE' ) ) );

        self::assertNotEmpty( $deletes );
        self::assertStringContainsString( 'DELETE i FROM wp_hof_index i', $deletes[0] );
        self::assertStringContainsString( 'p.post_type = %s', $deletes[0] );
        foreach ( $this->sql as $q ) {
            self::assertStringNotContainsString( 'TRUNCATE', $q );
        }
    }
}
