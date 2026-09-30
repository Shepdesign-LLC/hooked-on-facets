<?php
/**
 * @package HookedOnFacets\Tests
 */

declare(strict_types=1);

namespace HookedOnFacets\Tests;

use Brain\Monkey;
use Brain\Monkey\Functions;
use HookedOnFacets\Api\SourceCatalog;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use PHPUnit\Framework\TestCase;

/**
 * The catalog tells the editor what each source is (shape, counts, whether it
 * nests or carries colors) so the type picker can disable what doesn't fit.
 */
final class SourceCatalogTest extends TestCase {
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

    public function test_shape_follows_the_suggested_display(): void {
        self::assertSame( 'numeric', SourceCatalog::shape_for_display( 'range' ) );
        self::assertSame( 'date', SourceCatalog::shape_for_display( 'date_range' ) );
        self::assertSame( 'boolean', SourceCatalog::shape_for_display( 'toggle' ) );
        self::assertSame( 'text', SourceCatalog::shape_for_display( 'search' ) );
        self::assertSame( 'options', SourceCatalog::shape_for_display( 'checkbox' ) );
        self::assertSame( 'options', SourceCatalog::shape_for_display( 'dropdown' ) );
    }

    /**
     * $wpdb whose queries answer by which table/column the SQL touches.
     *
     * @param array<string, int> $answers substring of SQL => scalar result
     */
    private function wpdb( array $answers ): void {
        $wpdb               = Mockery::mock();
        $wpdb->term_taxonomy = 'wp_term_taxonomy';
        $wpdb->termmeta     = 'wp_termmeta';
        $wpdb->postmeta     = 'wp_postmeta';
        $wpdb->posts        = 'wp_posts';
        $wpdb->shouldReceive( 'prepare' )->andReturnUsing( static fn( $sql, ...$args ) => $sql );
        $wpdb->shouldReceive( 'get_var' )->andReturnUsing( static function ( $sql ) use ( $answers ) {
            foreach ( $answers as $needle => $value ) {
                if ( str_contains( $sql, $needle ) ) {
                    return $value;
                }
            }
            return 0;
        } );
        $GLOBALS['wpdb'] = $wpdb;
    }

    private function stubTaxonomies( array $taxes, array $terms = [] ): void {
        Functions\when( 'get_object_taxonomies' )->justReturn( $taxes );
        Functions\when( 'wp_count_terms' )->justReturn( 8 );
        Functions\when( 'get_terms' )->justReturn( $terms );
    }

    public function test_attribute_taxonomy_reports_counts_and_empty_terms(): void {
        $this->wpdb( [ 'parent > 0' => 0, 'wp_termmeta' => 0 ] );
        $this->stubTaxonomies(
            [ 'pa_brand' => (object) [ 'public' => true, 'hierarchical' => false, 'labels' => (object) [ 'singular_name' => 'Brand' ] ] ],
            [ (object) [ 'name' => 'Alder', 'count' => 5 ], (object) [ 'name' => 'Tundra', 'count' => 0 ] ]
        );

        $out = ( new SourceCatalog() )->for_post_type( 'product' );

        self::assertSame( 'taxonomy:pa_brand', $out[0]['id'] );
        self::assertSame( 'attribute', $out[0]['group'] );
        self::assertSame( 8, $out[0]['count'] );
        self::assertSame( [ 'Tundra' ], $out[0]['empty_terms'] );
        self::assertFalse( $out[0]['nested'] );
        self::assertFalse( $out[0]['visual'] );
        self::assertSame( 'checkbox', $out[0]['template']['display'] );
        self::assertSame( 'brand', $out[0]['template']['name'], 'The pa_ prefix is dropped from the suggested slug.' );
    }

    public function test_nested_taxonomy_suggests_hierarchy(): void {
        $this->wpdb( [ 'parent > 0' => 4, 'wp_termmeta' => 0 ] );
        $this->stubTaxonomies( [ 'product_cat' => (object) [ 'public' => true, 'hierarchical' => true, 'labels' => (object) [ 'singular_name' => 'Category' ] ] ] );

        $out = ( new SourceCatalog() )->for_post_type( 'product' );

        self::assertTrue( $out[0]['nested'] );
        self::assertSame( 'taxonomy', $out[0]['group'] );
        self::assertSame( 'hierarchy', $out[0]['template']['display'] );
    }

    public function test_taxonomy_with_swatch_meta_is_visual(): void {
        $this->wpdb( [ 'parent > 0' => 0, 'wp_termmeta' => 3 ] );
        $this->stubTaxonomies( [ 'pa_color' => (object) [ 'public' => true, 'labels' => (object) [ 'singular_name' => 'Color' ] ] ] );

        $out = ( new SourceCatalog() )->for_post_type( 'product' );

        self::assertTrue( $out[0]['visual'] );
        self::assertSame( 'swatch', $out[0]['template']['display'] );
    }

    public function test_plumbing_taxonomies_are_hidden(): void {
        $this->wpdb( [] );
        $this->stubTaxonomies( [
            'product_visibility' => (object) [ 'public' => false, 'show_ui' => true, 'labels' => (object) [ 'singular_name' => 'V' ] ],
            'post_format'        => (object) [ 'public' => true, 'labels' => (object) [ 'singular_name' => 'F' ] ],
        ] );

        $out = ( new SourceCatalog() )->for_post_type( 'post' );

        self::assertSame( [ 'field:post_title' ], array_column( $out, 'id' ), 'Only title search remains.' );
    }

    public function test_fields_are_listed_only_when_the_post_type_carries_them(): void {
        $this->wpdb( [ 'DISTINCT pm.meta_value' => 3 ] );
        $this->stubTaxonomies( [] );
        $provider = static fn() => [
            [ 'name' => 'difficulty', 'label' => 'Difficulty', 'kind' => 'meta', 'source' => 'difficulty', 'display' => 'radio', 'settings' => [] ],
            [ 'name' => 'terms', 'label' => 'Terms', 'kind' => 'taxonomy', 'source' => 'region', 'display' => 'checkbox', 'settings' => [] ],
        ];

        $out = ( new SourceCatalog( [ 'ACF' => $provider ] ) )->for_post_type( 'guide' );

        $field = $out[0];
        self::assertSame( 'meta:difficulty', $field['id'] );
        self::assertSame( 'ACF', $field['integration'] );
        self::assertSame( 'options', $field['shape'] );
        self::assertSame( 3, $field['count'] );
        self::assertCount( 2, $out, 'The taxonomy-kind suggestion is skipped; title search is added.' );
    }

    public function test_a_field_with_no_data_on_the_post_type_is_dropped(): void {
        $this->wpdb( [ 'DISTINCT pm.meta_value' => 0 ] );
        $this->stubTaxonomies( [] );
        $provider = static fn() => [
            [ 'name' => 'price', 'label' => 'Price', 'kind' => 'meta', 'source' => '_price', 'display' => 'range', 'settings' => [] ],
        ];

        $out = ( new SourceCatalog( [ 'WooCommerce' => $provider ] ) )->for_post_type( 'post' );

        self::assertSame( [ 'field:post_title' ], array_column( $out, 'id' ) );
    }

    public function test_numeric_field_has_no_option_count(): void {
        $this->wpdb( [ 'DISTINCT pm.meta_value' => 312 ] );
        $this->stubTaxonomies( [] );
        $provider = static fn() => [
            [ 'name' => 'price', 'label' => 'Price', 'kind' => 'meta', 'source' => '_price', 'display' => 'range', 'settings' => [] ],
        ];

        $out = ( new SourceCatalog( [ 'WooCommerce' => $provider ] ) )->for_post_type( 'product' );

        self::assertSame( 'numeric', $out[0]['shape'] );
        self::assertNull( $out[0]['count'] );
    }
}
