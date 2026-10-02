<?php
/**
 * Seed a small, known WooCommerce catalog for the admin's WooCommerce pass.
 *
 * Unlike seed-products.php (bulk benchmark rows), this builds real WC objects
 * so attribute sources, prices, swatches and nested categories behave exactly
 * as they do on a store. Safe to re-run: products are keyed by SKU.
 *
 *   docker compose exec wp-cli wp eval-file \
 *       wp-content/plugins/hooked-on-facets/bin/woo-pass-seed.php
 *
 * The catalog, and what the pass expects from it:
 *   Brand (pa_brand)  Alder 5, Kestrel 4, Orin 3, Tundra 0   <- Tundra has no products
 *   Color (pa_color)  Rust, Hook, Moss, each with a swatch color
 *   Categories        Outdoor > Packs, Boots; Apparel
 *   Prices            12 to 140; two products are out of stock
 *
 * @package HookedOnFacets
 */

defined( 'ABSPATH' ) || exit;

if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_create_attribute' ) ) {
    $msg = "WooCommerce isn't active. Run `wp plugin activate woocommerce` first.";
    // Exit non-zero so a script or CI step that runs the seed sees the failure.
    if ( class_exists( 'WP_CLI' ) ) {
        WP_CLI::error( $msg );
    }
    fwrite( STDERR, $msg . "\n" );
    exit( 1 );
}

/** Create a product attribute (global) and make sure its taxonomy is registered this request. */
function hof_pass_attribute( string $slug, string $label ): string {
    $tax = wc_attribute_taxonomy_name( $slug );
    if ( ! wc_attribute_taxonomy_id_by_name( $slug ) ) {
        $made = wc_create_attribute( [ 'name' => $label, 'slug' => $slug, 'type' => 'select', 'order_by' => 'menu_order', 'has_archives' => false ] );
        if ( is_wp_error( $made ) ) {
            fwrite( STDERR, "Could not create attribute $slug: " . $made->get_error_message() . "\n" );
            return $tax;
        }
        delete_transient( 'wc_attribute_taxonomies' );
    }
    if ( ! taxonomy_exists( $tax ) ) {
        register_taxonomy( $tax, 'product', [ 'hierarchical' => false, 'show_ui' => false, 'query_var' => true, 'rewrite' => false ] );
    }
    return $tax;
}

/** @return int term_id */
function hof_pass_term( string $name, string $taxonomy, int $parent = 0 ): int {
    $hit = term_exists( $name, $taxonomy, $parent );
    if ( $hit ) {
        return (int) ( is_array( $hit ) ? $hit['term_id'] : $hit );
    }
    $made = wp_insert_term( $name, $taxonomy, [ 'parent' => $parent ] );
    return is_wp_error( $made ) ? 0 : (int) $made['term_id'];
}

$brand = hof_pass_attribute( 'brand', 'Brand' );
$color = hof_pass_attribute( 'color', 'Color' );

$brands = [];
foreach ( [ 'Alder', 'Kestrel', 'Orin', 'Tundra' ] as $b ) {
    $brands[ $b ] = hof_pass_term( $b, $brand );
}

$swatches = [ 'Rust' => '#D85A30', 'Hook' => '#534AB7', 'Moss' => '#2E7D5B' ];
$colors   = [];
foreach ( $swatches as $name => $hex ) {
    $colors[ $name ] = hof_pass_term( $name, $color );
    update_term_meta( $colors[ $name ], 'swatch_color', $hex );
}

$outdoor = hof_pass_term( 'Outdoor', 'product_cat' );
$cats    = [
    'Packs'   => hof_pass_term( 'Packs', 'product_cat', $outdoor ),
    'Boots'   => hof_pass_term( 'Boots', 'product_cat', $outdoor ),
    'Apparel' => hof_pass_term( 'Apparel', 'product_cat' ),
];

// sku => [ name, price, brand, color, category, in stock ]
$catalog = [
    'HOF-A1' => [ 'Alder day pack',    24,  'Alder',   'Rust', 'Packs',   true ],
    'HOF-A2' => [ 'Alder trail pack',  39,  'Alder',   'Hook', 'Packs',   true ],
    'HOF-A3' => [ 'Alder field boot',  59,  'Alder',   'Moss', 'Boots',   true ],
    'HOF-A4' => [ 'Alder summit boot', 89,  'Alder',   'Rust', 'Boots',   false ],
    'HOF-A5' => [ 'Alder shell',       129, 'Alder',   'Hook', 'Apparel', true ],
    'HOF-K1' => [ 'Kestrel sling',     18,  'Kestrel', 'Moss', 'Packs',   true ],
    'HOF-K2' => [ 'Kestrel hiker',     45,  'Kestrel', 'Rust', 'Boots',   true ],
    'HOF-K3' => [ 'Kestrel fleece',    70,  'Kestrel', 'Hook', 'Apparel', false ],
    'HOF-K4' => [ 'Kestrel parka',     140, 'Kestrel', 'Moss', 'Apparel', true ],
    'HOF-O1' => [ 'Orin cap',          12,  'Orin',    'Rust', 'Apparel', true ],
    'HOF-O2' => [ 'Orin scout boot',   33,  'Orin',    'Hook', 'Boots',   true ],
    'HOF-O3' => [ 'Orin expedition',   99,  'Orin',    'Moss', 'Packs',   true ],
];

$made = 0;
foreach ( $catalog as $sku => [ $name, $price, $b, $c, $cat, $stock ] ) {
    if ( wc_get_product_id_by_sku( $sku ) ) {
        continue;
    }
    $p = new WC_Product_Simple();
    $p->set_name( $name );
    $p->set_sku( $sku );
    $p->set_status( 'publish' );
    $p->set_regular_price( (string) $price );
    $p->set_stock_status( $stock ? 'instock' : 'outofstock' );
    $p->set_category_ids( [ $cats[ $cat ] ] );

    $attrs = [];
    foreach ( [ $brand => $brands[ $b ], $color => $colors[ $c ] ] as $tax => $term_id ) {
        $a = new WC_Product_Attribute();
        $a->set_id( wc_attribute_taxonomy_id_by_name( $tax ) );
        $a->set_name( $tax );
        $a->set_options( [ $term_id ] );
        $a->set_visible( true );
        $a->set_variation( false );
        $attrs[] = $a;
    }
    $p->set_attributes( $attrs );
    $p->save();
    ++$made;
}

// A page to hold a facet and results, so the front end can be checked without a theme.
$page = get_page_by_path( 'woo-pass' );
if ( ! $page ) {
    wp_insert_post( [
        'post_type'    => 'page',
        'post_status'  => 'publish',
        'post_title'   => 'Woo pass',
        'post_name'    => 'woo-pass',
        'post_content' => "[hof_facet name=\"brand\"]\n\n[hof_facet name=\"price\"]\n\n[hof_results]",
    ] );
}

printf( "Seeded %d new product(s); %d in the pass catalog. Tundra has none, on purpose.\n", $made, count( $catalog ) );
echo "Next: wp hof reindex, then follow docs/design/woocommerce-pass.md.\n";
