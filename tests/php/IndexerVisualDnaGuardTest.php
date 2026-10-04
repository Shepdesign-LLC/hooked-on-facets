<?php
/**
 * @package HookedOnFacets\Tests
 */

declare(strict_types=1);

namespace HookedOnFacets\Tests;

use HookedOnFacets\Indexer;
use Brain\Monkey;
use Brain\Monkey\Functions;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use PHPUnit\Framework\TestCase;

/**
 * Regression guard: Visual DNA's ColorExtractor ships in HOF Pro, not core.
 * On a free-only install, publishing an indexed post must still index it —
 * the palette pass is skipped, never instantiated. Before the guard, every
 * publish (and every background reindex chunk) died with
 * `Class "HookedOnFacets\VisualDna\ColorExtractor" not found`.
 */
final class IndexerVisualDnaGuardTest extends TestCase {
    use MockeryPHPUnitIntegration;

    /** @var array<string, int> */
    private array $calls = [];

    protected function setUp(): void {
        parent::setUp();
        Monkey\setUp();

        // Facets are configured; every other option falls back to its default.
        Functions\when( 'get_option' )->alias( static function ( $name, $default = false ) {
            return Indexer::OPTION_FACETS === $name
                ? [ [ 'name' => 'brand', 'kind' => 'meta', 'source' => 'brand' ] ]
                : $default;
        } );
        Functions\when( 'update_option' )->justReturn( true );
        Functions\when( 'wp_is_post_revision' )->justReturn( false );
        Functions\when( 'wp_is_post_autosave' )->justReturn( false );
        Functions\when( 'apply_filters' )->returnArg( 2 );
        Functions\when( 'get_post_meta' )->justReturn( [] );

        $wpdb = Mockery::mock();
        $wpdb->prefix = 'wp_';
        foreach ( [ 'delete', 'insert', 'query' ] as $op ) {
            $wpdb->shouldReceive( $op )->andReturnUsing( function () use ( $op ) {
                $this->calls[ $op ] = ( $this->calls[ $op ] ?? 0 ) + 1;
                return 1;
            } );
        }
        $GLOBALS['wpdb'] = $wpdb;
    }

    protected function tearDown(): void {
        Monkey\tearDown();
        parent::tearDown();
    }

    public function test_core_has_no_color_extractor(): void {
        // The premise of this test: core ships without the Pro class.
        self::assertFalse( class_exists( \HookedOnFacets\VisualDna\ColorExtractor::class ) );
    }

    public function test_publishing_an_indexed_post_without_pro_does_not_fatal(): void {
        $post = new \WP_Post( [ 'ID' => 42, 'post_status' => 'publish', 'post_type' => 'product' ] );

        ( new Indexer() )->on_post_save( 42, $post, true );

        self::assertSame( 1, $this->calls['delete'] ?? 0, 'The reindex must still clear the old rows.' );
    }
}
