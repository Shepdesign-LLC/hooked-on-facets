<?php
/**
 * @package HookedOnFacets\Tests
 */

declare(strict_types=1);

namespace HookedOnFacets\Tests;

use Brain\Monkey;
use Brain\Monkey\Functions;
use HookedOnFacets\Api\PostTypeSettings;
use HookedOnFacets\Contracts\IndexJobs;
use HookedOnFacets\Indexer;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use Mockery\MockInterface;
use PHPUnit\Framework\TestCase;

/**
 * Settings → Post types. Switching one on indexes only that type in the
 * background, switching one off removes only its rows, and neither ever
 * truncates the index or starts a second job on top of a running one.
 */
final class PostTypeSettingsTest extends TestCase {
    use MockeryPHPUnitIntegration;

    /** @var array<string, mixed> */
    private array $options = [];

    /** @var MockInterface&IndexJobs */
    private $jobs;

    protected function setUp(): void {
        parent::setUp();
        Monkey\setUp();
        $this->options = [];
        $this->jobs    = Mockery::mock( IndexJobs::class );

        Functions\when( 'get_option' )->alias( fn( $name, $default = false ) => $this->options[ $name ] ?? $default );
        Functions\when( 'update_option' )->alias( function ( $name, $value ) {
            $this->options[ $name ] = $value;
            return true;
        } );
        Functions\when( 'apply_filters' )->alias( static fn( $hook, $value ) => $value );
        Functions\when( 'sanitize_key' )->alias( static fn( $k ) => strtolower( preg_replace( '/[^a-zA-Z0-9_\-]/', '', (string) $k ) ) );
        Functions\when( 'get_post_types' )->alias( static function () {
            $mk = static fn( string $label, bool $builtin ) => (object) [ 'labels' => (object) [ 'name' => $label ], '_builtin' => $builtin ];
            return [
                'post'       => $mk( 'Posts', true ),
                'page'       => $mk( 'Pages', true ),
                'attachment' => $mk( 'Media', true ),
                'product'    => $mk( 'Products', false ),
                'guide'      => $mk( 'Trail guides', false ),
                'dealer'     => $mk( 'Dealers', false ),
            ];
        } );
    }

    protected function tearDown(): void {
        unset( $GLOBALS['wpdb'] );
        Monkey\tearDown();
        parent::tearDown();
    }

    private function wpdb( array $counts ): void {
        $wpdb        = Mockery::mock();
        $wpdb->posts = 'wp_posts';
        $wpdb->shouldReceive( 'prepare' )->andReturnUsing( static fn( $sql ) => $sql );
        $wpdb->shouldReceive( 'get_results' )->andReturn(
            array_map( static fn( $t, $n ) => [ 'type' => $t, 'n' => (string) $n ], array_keys( $counts ), $counts )
        );
        $GLOBALS['wpdb'] = $wpdb;
    }

    // ── reading ──────────────────────────────────────────────────────────

    public function test_lists_public_post_types_with_counts_and_indexing_state(): void {
        $this->wpdb( [ 'product' => 1200, 'guide' => 84, 'post' => 312, 'page' => 14, 'dealer' => 0 ] );
        $this->options[ Indexer::OPTION_POST_TYPES ] = [ 'product', 'guide', 'post' ];

        $out = ( new PostTypeSettings( $this->jobs ) )->all();

        self::assertSame( [ 'product', 'dealer', 'guide', 'page', 'post' ], array_column( $out['post_types'], 'slug' ), 'Products, custom by label A to Z (Dealers, Trail guides), then built-ins.' );
        $by = array_column( $out['post_types'], null, 'slug' );
        self::assertSame( 1200, $by['product']['items'] );
        self::assertTrue( $by['product']['indexed'] );
        self::assertTrue( $by['product']['woocommerce'] );
        self::assertTrue( $by['guide']['custom'] );
        self::assertFalse( $by['page']['indexed'] );
        self::assertFalse( $by['post']['custom'] );
        self::assertSame( 0, $by['dealer']['items'] );
        self::assertFalse( $out['managed_by_filter'] );
    }

    public function test_media_is_not_offered(): void {
        $this->wpdb( [] );

        $slugs = array_column( ( new PostTypeSettings( $this->jobs ) )->all()['post_types'], 'slug' );

        self::assertNotContains( 'attachment', $slugs );
    }

    public function test_defaults_apply_until_a_choice_is_saved(): void {
        $this->wpdb( [] );

        $by = array_column( ( new PostTypeSettings( $this->jobs ) )->all()['post_types'], null, 'slug' );

        self::assertTrue( $by['post']['indexed'] );
        self::assertTrue( $by['page']['indexed'] );
        self::assertTrue( $by['product']['indexed'] );
        self::assertFalse( $by['guide']['indexed'] );
    }

    public function test_reports_when_a_developer_filter_is_changing_the_list(): void {
        $this->wpdb( [] );
        Functions\when( 'apply_filters' )->alias( static fn( $hook, $value ) => array_merge( $value, [ 'guide' ] ) );

        $out = ( new PostTypeSettings( $this->jobs ) )->all();

        self::assertTrue( $out['managed_by_filter'] );
        self::assertTrue( array_column( $out['post_types'], null, 'slug' )['guide']['indexed'] );
    }

    // ── pure helpers ─────────────────────────────────────────────────────

    public function test_normalize_drops_unknown_and_junk_slugs(): void {
        $out = PostTypeSettings::normalize( [ 'Product', 'guide', 'ghost', [ 'x' ], 'guide', 'post!' ], [ 'post', 'product', 'guide' ] );

        self::assertSame( [ 'product', 'guide', 'post' ], $out );
    }

    public function test_diff_reports_what_was_added_and_removed(): void {
        self::assertSame( [ [ 'guide' ], [ 'page' ] ], PostTypeSettings::diff( [ 'post', 'page' ], [ 'post', 'guide' ] ) );
        self::assertSame( [ [], [] ], PostTypeSettings::diff( [ 'post' ], [ 'post' ] ) );
    }

    // ── switching on ─────────────────────────────────────────────────────

    public function test_turning_one_on_queues_a_background_index_for_only_that_type(): void {
        $this->options[ Indexer::OPTION_POST_TYPES ] = [ 'product' ];
        $this->jobs->shouldReceive( 'background_state' )->andReturn( [ 'running' => false ] );
        $this->jobs->shouldReceive( 'can_run_background' )->andReturn( true );
        $this->jobs->shouldReceive( 'queue_reindex_types' )->once()->with( [ 'guide' ] )->andReturn( [ 'job_id' => 'j' ] );
        $this->jobs->shouldNotReceive( 'delete_post_type_rows' );

        $out = ( new PostTypeSettings( $this->jobs ) )->save( [ 'product', 'guide' ] );

        self::assertSame( 200, $out['status'] );
        self::assertSame( 'background', $out['queued'] );
        self::assertSame( [ 'guide' ], $out['added'] );
        self::assertSame( [ 'product', 'guide' ], $this->options[ Indexer::OPTION_POST_TYPES ] );
    }

    public function test_it_reports_manual_when_no_scheduler_is_available(): void {
        $this->options[ Indexer::OPTION_POST_TYPES ] = [ 'product' ];
        $this->jobs->shouldReceive( 'background_state' )->andReturn( [ 'running' => false ] );
        $this->jobs->shouldReceive( 'can_run_background' )->andReturn( false );
        $this->jobs->shouldNotReceive( 'queue_reindex_types' );

        $out = ( new PostTypeSettings( $this->jobs ) )->save( [ 'product', 'guide' ] );

        self::assertSame( 'manual', $out['queued'] );
        self::assertContains( 'guide', $this->options[ Indexer::OPTION_POST_TYPES ], 'The choice is still saved.' );
    }

    public function test_it_refuses_to_add_a_type_while_a_rebuild_is_running_and_changes_nothing(): void {
        $this->options[ Indexer::OPTION_POST_TYPES ] = [ 'product' ];
        $this->jobs->shouldReceive( 'background_state' )->andReturn( [ 'running' => true ] );
        $this->jobs->shouldNotReceive( 'queue_reindex_types' );
        $this->jobs->shouldNotReceive( 'delete_post_type_rows' );

        $out = ( new PostTypeSettings( $this->jobs ) )->save( [ 'product', 'guide' ] );

        self::assertSame( 409, $out['status'] );
        self::assertStringContainsString( 'already running', $out['message'] );
        self::assertSame( [ 'product' ], $this->options[ Indexer::OPTION_POST_TYPES ], 'Nothing was saved.' );
    }

    public function test_a_running_rebuild_does_not_block_turning_one_off(): void {
        $this->options[ Indexer::OPTION_POST_TYPES ] = [ 'product', 'guide' ];
        $this->jobs->shouldReceive( 'background_state' )->andReturn( [ 'running' => true ] );
        $this->jobs->shouldReceive( 'delete_post_type_rows' )->once()->with( 'guide' );

        $out = ( new PostTypeSettings( $this->jobs ) )->save( [ 'product' ] );

        self::assertSame( 200, $out['status'] );
        self::assertSame( [ 'guide' ], $out['removed'] );
    }

    // ── switching off ────────────────────────────────────────────────────

    public function test_turning_one_off_removes_only_its_rows_and_queues_nothing(): void {
        $this->options[ Indexer::OPTION_POST_TYPES ] = [ 'product', 'guide', 'post' ];
        $this->jobs->shouldReceive( 'background_state' )->andReturn( [ 'running' => false ] );
        $this->jobs->shouldReceive( 'delete_post_type_rows' )->once()->with( 'post' );
        $this->jobs->shouldNotReceive( 'queue_reindex_types' );

        $out = ( new PostTypeSettings( $this->jobs ) )->save( [ 'product', 'guide' ] );

        self::assertSame( 'none', $out['queued'] );
        self::assertSame( [ 'post' ], $out['removed'] );
    }

    public function test_saving_the_same_choice_does_no_work(): void {
        $this->options[ Indexer::OPTION_POST_TYPES ] = [ 'product', 'post' ];
        $this->jobs->shouldReceive( 'background_state' )->andReturn( [ 'running' => false ] );
        $this->jobs->shouldNotReceive( 'queue_reindex_types' );
        $this->jobs->shouldNotReceive( 'delete_post_type_rows' );

        $out = ( new PostTypeSettings( $this->jobs ) )->save( [ 'product', 'post' ] );

        self::assertSame( [ 'status' => 200, 'queued' => 'none', 'added' => [], 'removed' => [] ], $out );
    }

    public function test_an_unknown_post_type_cannot_be_switched_on(): void {
        $this->options[ Indexer::OPTION_POST_TYPES ] = [ 'product' ];
        $this->jobs->shouldReceive( 'background_state' )->andReturn( [ 'running' => false ] );
        $this->jobs->shouldNotReceive( 'queue_reindex_types' );

        $out = ( new PostTypeSettings( $this->jobs ) )->save( [ 'product', 'ghost' ] );

        self::assertSame( [], $out['added'] );
        self::assertSame( [ 'product' ], $this->options[ Indexer::OPTION_POST_TYPES ] );
    }

    public function test_every_post_type_can_be_switched_off(): void {
        $this->options[ Indexer::OPTION_POST_TYPES ] = [ 'product' ];
        $this->jobs->shouldReceive( 'background_state' )->andReturn( [ 'running' => false ] );
        $this->jobs->shouldReceive( 'delete_post_type_rows' )->once()->with( 'product' );

        ( new PostTypeSettings( $this->jobs ) )->save( [] );

        self::assertSame( [], $this->options[ Indexer::OPTION_POST_TYPES ], 'An empty choice is honored, not reset to defaults.' );
        self::assertSame( [], Indexer::saved_post_types() );
    }
}
