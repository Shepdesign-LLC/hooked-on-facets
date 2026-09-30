<?php
/**
 * @package HookedOnFacets\Tests
 */

declare(strict_types=1);

namespace HookedOnFacets\Tests;

use Brain\Monkey;
use Brain\Monkey\Functions;
use HookedOnFacets\Api\IndexerStats;
use HookedOnFacets\Indexer;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use PHPUnit\Framework\TestCase;

/**
 * Covers the read model behind GET /indexer/stats: which post type a facet
 * belongs to, when it reads as indexing, and the assembled snapshot.
 */
final class IndexerStatsTest extends TestCase {
    use MockeryPHPUnitIntegration;

    protected function setUp(): void {
        parent::setUp();
        Monkey\setUp();
        Functions\when( 'sanitize_key' )->alias( static fn( $k ) => strtolower( preg_replace( '/[^a-zA-Z0-9_\-]/', '', (string) $k ) ) );
    }

    protected function tearDown(): void {
        unset( $GLOBALS['wpdb'] );
        Monkey\tearDown();
        parent::tearDown();
    }

    // ── resolve_post_type ────────────────────────────────────────────────

    public function test_explicit_post_type_wins_over_everything(): void {
        $facet = [ 'kind' => 'taxonomy', 'source' => 'product_cat', 'post_type' => 'guide' ];

        self::assertSame( 'guide', IndexerStats::resolve_post_type( $facet, 'product', static fn() => null ) );
    }

    public function test_dominant_indexed_post_type_beats_taxonomy_registration(): void {
        $facet = [ 'kind' => 'taxonomy', 'source' => 'region' ];
        $tax   = (object) [ 'object_type' => [ 'post' ] ];

        self::assertSame( 'guide', IndexerStats::resolve_post_type( $facet, 'guide', static fn() => $tax ) );
    }

    public function test_falls_back_to_first_taxonomy_object_type(): void {
        $facet = [ 'kind' => 'taxonomy', 'source' => 'product_cat' ];
        $tax   = (object) [ 'object_type' => [ 'product', 'bundle' ] ];

        self::assertSame( 'product', IndexerStats::resolve_post_type( $facet, '', static fn() => $tax ) );
    }

    public function test_unresolvable_facet_has_empty_post_type(): void {
        self::assertSame( '', IndexerStats::resolve_post_type( [ 'kind' => 'meta', 'source' => '_x' ], '', static fn() => null ) );
        self::assertSame( '', IndexerStats::resolve_post_type( [ 'kind' => 'taxonomy', 'source' => 'gone' ], '', static fn() => false ) );
    }

    // ── dominant_post_types ──────────────────────────────────────────────

    public function test_dominant_post_type_is_the_one_with_most_objects_per_facet(): void {
        $out = IndexerStats::dominant_post_types( [
            [ 'facet' => 'brand',  'post_type' => 'product', 'n' => '40' ],
            [ 'facet' => 'brand',  'post_type' => 'post',    'n' => '3' ],
            [ 'facet' => 'region', 'post_type' => 'guide',   'n' => '12' ],
        ] );

        self::assertSame( [ 'brand' => 'product', 'region' => 'guide' ], $out );
    }

    public function test_dominant_post_type_ties_break_alphabetically(): void {
        $out = IndexerStats::dominant_post_types( [
            [ 'facet' => 'x', 'post_type' => 'post',    'n' => 5 ],
            [ 'facet' => 'x', 'post_type' => 'product', 'n' => 5 ],
        ] );

        self::assertSame( [ 'x' => 'post' ], $out );
    }

    // ── status_for ───────────────────────────────────────────────────────

    public function test_status_is_indexing_for_every_facet_while_a_job_runs(): void {
        self::assertSame( 'indexing', IndexerStats::status_for( 0, true ) );
        self::assertSame( 'indexing', IndexerStats::status_for( 120, true ) );
    }

    public function test_status_is_indexed_with_rows_and_pending_without(): void {
        self::assertSame( 'indexed', IndexerStats::status_for( 1, false ) );
        self::assertSame( 'pending', IndexerStats::status_for( 0, false ) );
        self::assertSame( 'indexed', IndexerStats::status_for( 0, false, false ), 'View facets own no index rows.' );
    }

    // ── snapshot ─────────────────────────────────────────────────────────

    public function test_snapshot_assembles_post_types_and_facet_stats(): void {
        Functions\when( 'get_option' )->alias( static fn( $name, $default = false ) => $default );
        Functions\when( 'apply_filters' )->alias( static fn( $hook, $value ) => $value );
        Functions\when( 'get_taxonomy' )->justReturn( null );
        Functions\when( 'get_post_type_object' )->alias( static function ( $slug ) {
            return match ( $slug ) {
                'product' => (object) [ 'labels' => (object) [ 'name' => 'Products' ], '_builtin' => false ],
                'post'    => (object) [ 'labels' => (object) [ 'name' => 'Posts' ],    '_builtin' => true ],
                default   => null,
            };
        } );

        $wpdb         = Mockery::mock();
        $wpdb->prefix = 'wp_';
        $wpdb->posts  = 'wp_posts';
        $wpdb->shouldReceive( 'prepare' )->andReturnUsing( static fn( $sql, $args ) => $sql );
        $wpdb->shouldReceive( 'get_results' )->andReturnUsing( static function ( $sql ) {
            if ( str_contains( $sql, 'GROUP BY post_type' ) ) {
                return [ [ 'type' => 'product', 'n' => '1200' ], [ 'type' => 'post', 'n' => '312' ] ];
            }
            if ( str_contains( $sql, 'INNER JOIN' ) ) {
                return [ [ 'facet' => 'brand', 'post_type' => 'product', 'n' => '1200' ] ];
            }
            return [
                [ 'name' => 'brand', 'rows_n' => '1200', 'values_n' => '8', 'objects_n' => '1200' ],
            ];
        } );
        $GLOBALS['wpdb'] = $wpdb;

        $out = ( new IndexerStats( new Indexer() ) )->snapshot( [
            [ 'name' => 'brand',    'kind' => 'taxonomy', 'source' => 'pa_brand', 'display' => 'checkbox' ],
            [ 'name' => 'fresh',    'kind' => 'taxonomy', 'source' => 'pa_new',   'display' => 'checkbox' ],
        ] );

        self::assertSame(
            [
                [ 'slug' => 'post',    'label' => 'Posts',    'items' => 312,  'custom' => false ],
                [ 'slug' => 'page',    'label' => 'page',     'items' => 0,    'custom' => false ],
                [ 'slug' => 'product', 'label' => 'Products', 'items' => 1200, 'custom' => false ],
            ],
            $out['post_types']
        );
        self::assertSame( 5, $out['registered_post_types'], 'The denominator for "3 of 5".' );
        self::assertSame( [ 'rows' => 14206, 'objects' => 1596 ], $out['totals'] );
        self::assertSame( 8, $out['facets']['brand']['values'] );
        self::assertSame( 'product', $out['facets']['brand']['post_type'] );
        self::assertSame( 'indexed', $out['facets']['brand']['status'] );
        self::assertSame( 0, $out['facets']['fresh']['values'] );
        self::assertSame( 'pending', $out['facets']['fresh']['status'], 'A facet with no rows yet has not been indexed.' );
    }
}
