<?php
/**
 * @package HookedOnFacets\Tests
 */

declare(strict_types=1);

namespace HookedOnFacets\Tests;

use Brain\Monkey;
use Brain\Monkey\Functions;
use HookedOnFacets\Api\RestController;
use HookedOnFacets\Filter\Resolver;
use HookedOnFacets\Indexer;
use PHPUnit\Framework\TestCase;

/**
 * The facet save route keeps an optional `post_type` so the admin can group
 * facets by what they apply to. Unknown shapes are cleaned, not trusted.
 */
final class RestFacetSaveTest extends TestCase {

    /** @var array<string, mixed> */
    private array $saved = [];

    protected function setUp(): void {
        parent::setUp();
        Monkey\setUp();
        $this->saved = [];

        Functions\when( 'sanitize_key' )->alias( static fn( $k ) => strtolower( preg_replace( '/[^a-zA-Z0-9_\-]/', '', (string) $k ) ) );
        Functions\when( 'sanitize_text_field' )->alias( static fn( $v ) => trim( (string) $v ) );
        Functions\when( 'apply_filters' )->alias( static fn( $hook, $value ) => $value );
        Functions\when( 'update_option' )->alias( function ( $name, $value ) {
            $this->saved[ $name ] = $value;
            return true;
        } );
    }

    protected function tearDown(): void {
        Monkey\tearDown();
        parent::tearDown();
    }

    private function save( array $facets ): array {
        $controller = new RestController( new Resolver(), new Indexer() );
        $response   = $controller->save_facets( new \WP_REST_Request( [ 'facets' => $facets ] ) );

        return $response->get_data()['facets'];
    }

    public function test_post_type_is_persisted_and_sanitized(): void {
        $out = $this->save( [
            [ 'name' => 'region', 'kind' => 'taxonomy', 'source' => 'region', 'display' => 'checkbox', 'post_type' => 'Guide<script>' ],
        ] );

        self::assertSame( 'guidescript', $out[0]['post_type'] );
        self::assertSame( $out, $this->saved[ Indexer::OPTION_FACETS ] );
    }

    public function test_facets_without_a_post_type_stay_without_one(): void {
        $out = $this->save( [
            [ 'name' => 'brand', 'kind' => 'taxonomy', 'source' => 'pa_brand', 'display' => 'checkbox' ],
        ] );

        self::assertArrayNotHasKey( 'post_type', $out[0], 'The key is omitted, not stored empty.' );
    }

    private function facet( array $over = [] ): array {
        return $over + [ 'name' => 'brand', 'kind' => 'taxonomy', 'source' => 'pa_brand', 'display' => 'checkbox' ];
    }

    // ── reindex on save ──────────────────────────────────────────────────

    public function test_first_save_of_a_facet_needs_a_reindex(): void {
        self::assertTrue( Indexer::facets_need_reindex( [], [ $this->facet() ] ) );
    }

    public function test_changing_the_source_needs_a_reindex(): void {
        self::assertTrue( Indexer::facets_need_reindex( [ $this->facet() ], [ $this->facet( [ 'source' => 'pa_maker' ] ) ] ) );
    }

    public function test_removing_a_facet_needs_a_reindex(): void {
        self::assertTrue( Indexer::facets_need_reindex( [ $this->facet(), $this->facet( [ 'name' => 'color' ] ) ], [ $this->facet() ] ) );
    }

    public function test_switching_to_date_range_needs_a_reindex(): void {
        self::assertTrue( Indexer::facets_need_reindex( [ $this->facet() ], [ $this->facet( [ 'display' => 'date_range' ] ) ] ) );
    }

    public function test_label_order_and_display_settings_do_not_reindex(): void {
        $a = [ $this->facet( [ 'label' => 'Brand' ] ), $this->facet( [ 'name' => 'color', 'source' => 'pa_color' ] ) ];
        $b = [ $this->facet( [ 'name' => 'color', 'source' => 'pa_color', 'display' => 'radio' ] ), $this->facet( [ 'label' => 'Maker', 'settings' => [ 'match' => 'all' ] ] ) ];

        self::assertFalse( Indexer::facets_need_reindex( $a, $b ) );
    }

    public function test_save_reports_a_reindex_only_when_the_index_is_stale(): void {
        $controller = new RestController( new Resolver(), new Indexer() );
        $payload    = [ $this->facet() ];

        $first  = $controller->save_facets( new \WP_REST_Request( [ 'facets' => $payload ] ) )->get_data();
        $second = $controller->save_facets( new \WP_REST_Request( [ 'facets' => $payload ] ) )->get_data();

        self::assertSame( 'needed', $first['reindex'], 'A brand new facet has no index rows yet.' );
        self::assertSame( 'none', $second['reindex'], 'Saving the same facets again leaves the index alone.' );
    }
}
