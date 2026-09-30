<?php
/**
 * @package HookedOnFacets\Tests
 */

declare(strict_types=1);

namespace HookedOnFacets\Tests;

use Brain\Monkey;
use Brain\Monkey\Functions;
use HookedOnFacets\Api\RestController;
use HookedOnFacets\Facets\Renderer;
use HookedOnFacets\Filter\Resolver;
use HookedOnFacets\Indexer;
use HookedOnFacets\Routing\FilterState;
use HookedOnFacets\Routing\PrettySurface;
use PHPUnit\Framework\TestCase;

/**
 * Button style is an option on the checkbox and radio displays. These cover
 * the markup contract the public runtime and stylesheet rely on, and the
 * guarantee that switching style never changes the URL state or the links.
 */
final class RendererButtonsTest extends TestCase {

    /** @var array<string, mixed> */
    private array $options = [];

    protected function setUp(): void {
        parent::setUp();
        Monkey\setUp();
        $_GET          = [];
        $this->options = [];
        FilterState::reset();
        PrettySurface::reset();

        Functions\when( 'get_option' )->alias( fn( $name, $default = false ) => $this->options[ $name ] ?? $default );
        Functions\when( 'get_query_var' )->justReturn( '' );
        Functions\when( 'did_action' )->justReturn( 1 );
        Functions\when( 'wp_unslash' )->returnArg();
        Functions\when( 'sanitize_text_field' )->alias( static fn( $s ) => trim( (string) $s ) );
        Functions\when( 'sanitize_key' )->alias( static fn( $s ) => strtolower( preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $s ) ) ) );
        Functions\when( 'sanitize_title' )->alias(
            static fn( $t ) => trim( preg_replace( '/[^a-z0-9-]+/', '-', strtolower( (string) $t ) ), '-' )
        );
        Functions\when( 'esc_attr' )->returnArg();
        Functions\when( 'esc_html' )->returnArg();
        Functions\when( 'esc_url' )->returnArg();
        Functions\when( 'esc_html_e' )->alias( static function ( $s ) { echo $s; } );
        Functions\when( 'checked' )->alias( static fn( $c ) => $c ? 'checked' : '' );
        Functions\when( 'selected' )->justReturn( '' );
        Functions\when( 'number_format_i18n' )->alias( static fn( $n ) => (string) $n );
        Functions\when( 'user_trailingslashit' )->alias( static fn( $s ) => rtrim( (string) $s, '/' ) . '/' );
        Functions\when( 'wp_parse_url' )->alias( static fn( $url ) => parse_url( (string) $url ) );
        Functions\when( 'is_ssl' )->justReturn( true );
        Functions\when( 'wp_cache_get' )->justReturn( false );
        Functions\when( 'wp_cache_set' )->justReturn( true );
        Functions\when( 'is_shop' )->justReturn( true );
        Functions\when( 'is_product_taxonomy' )->justReturn( false );
        // Every brand the store has, including Tundra which nothing is filed under.
        Functions\when( 'get_terms' )->justReturn( [
            (object) [ 'slug' => 'adidas', 'name' => 'Adidas' ],
            (object) [ 'slug' => 'nike', 'name' => 'Nike' ],
            (object) [ 'slug' => 'tundra', 'name' => 'Tundra' ],
        ] );

        $_SERVER['HTTP_HOST']   = 'shop.test';
        $_SERVER['REQUEST_URI'] = '/shop/';

        $GLOBALS['wpdb'] = new class() {
            public string $prefix = 'wp_';
            public function prepare( string $sql, ...$args ): string {
                return str_replace( '%s', "'" . $args[0] . "'", $sql );
            }
            public function get_col( string $sql ): array {
                return str_contains( $sql, "'brand'" ) ? [ 'adidas', 'nike', 'tundra' ] : [];
            }
        };
    }

    protected function tearDown(): void {
        unset( $GLOBALS['wpdb'], $_SERVER['HTTP_HOST'], $_SERVER['REQUEST_URI'] );
        $_GET = [];
        FilterState::reset();
        PrettySurface::reset();
        Monkey\tearDown();
        parent::tearDown();
    }

    /** @param array<string, mixed> $settings */
    private function facet( string $display = 'checkbox', array $settings = [] ): array {
        return [
            'name' => 'brand', 'label' => 'Brand', 'kind' => 'taxonomy', 'source' => 'pa_brand',
            'display' => $display, 'settings' => $settings,
        ];
    }

    private function withPrettyUrls( array $facet ): void {
        $this->options['hof_facets']          = [ $facet ];
        $this->options['permalink_structure'] = '/%postname%/';
        $this->options['hof_pretty_urls']     = [ 'enabled' => true, 'base' => 'filter' ];
    }

    /**
     * Render through the private display method, as the sibling renderer
     * tests do. Tundra has no products, so it is absent from the buckets.
     *
     * @param array<string, mixed> $settings
     * @param list<string>         $selected
     */
    private function render( string $display, array $settings = [], array $selected = [] ): string {
        $counts = [
            'type'    => 'values',
            'buckets' => [
                [ 'value' => 'nike', 'display' => 'Nike', 'count' => 6 ],
                [ 'value' => 'adidas', 'display' => 'Adidas', 'count' => 4 ],
            ],
        ];
        $method = new \ReflectionMethod( Renderer::class, $display === 'radio' ? 'render_radio' : 'render_checkbox' );
        $method->setAccessible( true );
        return (string) $method->invoke( new Renderer( new Resolver() ), $this->facet( $display, $settings ), $selected, $counts );
    }

    // ── list vs buttons ──────────────────────────────────────────────────

    public function test_list_style_is_the_default_and_renders_inputs(): void {
        $html = $this->render( 'checkbox' );

        self::assertStringContainsString( '<input type="checkbox"', $html );
        self::assertStringNotContainsString( 'hof-btn', $html );
        self::assertStringNotContainsString( 'data-hof-style', $html );
    }

    public function test_buttons_style_renders_buttons_not_inputs(): void {
        $html = $this->render( 'checkbox', [ 'style' => 'buttons' ] );

        self::assertStringContainsString( '<div class="hof-facet__buttons">', $html );
        self::assertStringContainsString( 'data-hof-style="buttons"', $html );
        self::assertStringNotContainsString( '<input', $html );
        // The exact contract the runtime and stylesheet read.
        self::assertMatchesRegularExpression(
            '/<button type="button"\s+class="hof-btn hof-btn--pill hof-btn--outline"\s+data-value="nike"\s+aria-pressed="false"\s*>/',
            $html
        );
    }

    public function test_explicit_list_style_matches_the_default(): void {
        self::assertSame( $this->render( 'checkbox' ), $this->render( 'checkbox', [ 'style' => 'list' ] ) );
    }

    public function test_the_wrapper_keeps_the_display_class_and_data_attributes(): void {
        $html = $this->render( 'radio', [ 'style' => 'buttons' ] );

        self::assertStringContainsString( 'class="hof-facet hof-facet-radio"', $html );
        self::assertStringContainsString( 'data-hof-facet="brand"', $html );
        self::assertStringContainsString( 'data-hof-display="radio"', $html );
    }

    public function test_shape_and_fill_pick_the_modifier_classes(): void {
        $html = $this->render( 'checkbox', [ 'style' => 'buttons', 'button_shape' => 'square', 'button_fill' => 'tinted' ] );

        self::assertStringContainsString( 'class="hof-btn hof-btn--square hof-btn--tinted"', $html );
        self::assertStringNotContainsString( 'hof-btn--pill', $html );
    }

    public function test_unknown_shape_and_fill_fall_back_to_pill_and_outline(): void {
        $html = $this->render( 'checkbox', [ 'style' => 'buttons', 'button_shape' => 'blob', 'button_fill' => 'neon' ] );

        self::assertStringContainsString( 'hof-btn--pill hof-btn--outline', $html );
    }

    // ── selected state ───────────────────────────────────────────────────

    public function test_selected_values_are_aria_pressed(): void {
        $html = $this->render( 'checkbox', [ 'style' => 'buttons' ], [ 'nike', 'adidas' ] );

        self::assertSame( 2, substr_count( $html, 'aria-pressed="true"' ) );
        self::assertSame( 1, substr_count( $html, 'aria-pressed="false"' ), 'Tundra is the only unpressed button.' );
    }

    public function test_radio_marks_only_one_value_pressed(): void {
        $html = $this->render( 'radio', [ 'style' => 'buttons' ], [ 'nike', 'adidas' ] );

        self::assertSame( 1, substr_count( $html, 'aria-pressed="true"' ), 'Radio semantics: one selected at a time.' );
        self::assertMatchesRegularExpression( '/data-value="nike"\s+aria-pressed="true"/', $html );
    }

    // ── counts ───────────────────────────────────────────────────────────

    public function test_count_renders_on_the_button_by_default(): void {
        $html = $this->render( 'checkbox', [ 'style' => 'buttons' ] );

        self::assertStringContainsString( '<span class="hof-btn__count"', $html );
        self::assertMatchesRegularExpression( '/data-hof-count="nike">6<\/span>/', $html );
    }

    public function test_count_is_omitted_when_button_count_is_off(): void {
        $html = $this->render( 'checkbox', [ 'style' => 'buttons', 'button_count' => false ] );

        self::assertStringNotContainsString( 'hof-btn__count', $html );
    }

    // ── show empty ───────────────────────────────────────────────────────

    public function test_show_empty_on_renders_a_dimmed_disabled_button_for_a_value_with_no_products(): void {
        $html = $this->render( 'checkbox', [ 'style' => 'buttons', 'show_empty' => true ] );

        self::assertMatchesRegularExpression(
            '/class="hof-btn hof-btn--pill hof-btn--outline hof-btn--empty"\s+data-value="tundra"\s+aria-pressed="false"\s+disabled>/',
            $html
        );
        self::assertMatchesRegularExpression( '/data-hof-count="tundra">0<\/span>/', $html );
    }

    public function test_show_empty_is_on_by_default(): void {
        self::assertStringContainsString( 'data-value="tundra"', $this->render( 'checkbox', [ 'style' => 'buttons' ] ) );
    }

    public function test_show_empty_off_omits_the_value(): void {
        $html = $this->render( 'checkbox', [ 'style' => 'buttons', 'show_empty' => false ] );

        self::assertStringNotContainsString( 'tundra', $html );
        self::assertStringNotContainsString( 'hof-btn--empty', $html );
        self::assertStringContainsString( 'data-value="nike"', $html );
    }

    public function test_a_selected_value_with_no_results_stays_clickable_so_it_can_be_cleared(): void {
        $html = $this->render( 'checkbox', [ 'style' => 'buttons' ], [ 'tundra' ] );

        self::assertMatchesRegularExpression( '/class="hof-btn hof-btn--pill hof-btn--outline"\s+data-value="tundra"\s+aria-pressed="true"\s*>/', $html );
    }

    public function test_merge_empty_values_appends_only_the_missing_ones_in_display_order(): void {
        $out = Renderer::merge_empty_values(
            [ [ 'value' => 'nike', 'display' => 'Nike', 'count' => 6 ] ],
            [ 'nike' => 'Nike', 'zed' => 'Zed', 'alder' => 'Alder' ]
        );

        self::assertSame( [ 'nike', 'alder', 'zed' ], array_column( $out, 'value' ) );
        self::assertSame( [ 6, 0, 0 ], array_column( $out, 'count' ) );
    }

    // ── URL state is identical between styles ────────────────────────────

    public function test_buttons_emit_the_same_crawlable_links_as_the_list(): void {
        $this->withPrettyUrls( $this->facet( 'checkbox', [ 'style' => 'buttons' ] ) );
        $list    = $this->render( 'checkbox' );
        $buttons = $this->render( 'checkbox', [ 'style' => 'buttons' ] );

        preg_match_all( '/href="([^"]+)"/', $list, $listLinks );
        preg_match_all( '/href="([^"]+)"/', $buttons, $buttonLinks );

        self::assertNotEmpty( $listLinks[1] );
        self::assertSame( $listLinks[1], $buttonLinks[1], 'Switching style must not change a single link.' );
        self::assertStringContainsString( '<ul class="hof-facet-seo-links">', $buttons );
    }

    public function test_buttons_do_not_link_to_values_with_no_results(): void {
        $this->withPrettyUrls( $this->facet( 'checkbox', [ 'style' => 'buttons' ] ) );
        $html = $this->render( 'checkbox', [ 'style' => 'buttons' ] );

        self::assertStringNotContainsString( 'brand/tundra', $html );
    }

    public function test_a_button_carries_the_same_value_the_list_input_would(): void {
        $list    = $this->render( 'checkbox' );
        $buttons = $this->render( 'checkbox', [ 'style' => 'buttons' ] );

        preg_match_all( '/<input type="checkbox"[^>]*value="([^"]*)"/s', $list, $inputs );
        preg_match_all( '/data-value="([^"]*)"/', $buttons, $data );

        // Every value the list submits as ?hof[brand][]=… is a button value.
        self::assertSame( [], array_diff( $inputs[1], $data[1] ) );
    }

    public function test_radio_link_for_the_pressed_value_clears_the_facet(): void {
        // Clicking the selected radio button clears it. The crawlable link is
        // the server's statement of that: pressed value → the un-filtered URL.
        $this->withPrettyUrls( $this->facet( 'radio', [ 'style' => 'buttons' ] ) );
        $_GET['hof'] = [ 'brand' => [ 'nike' ] ];

        $html = $this->render( 'radio', [ 'style' => 'buttons' ], [ 'nike' ] );

        self::assertMatchesRegularExpression( '/data-value="nike"\s+aria-pressed="true"/', $html );
        self::assertStringContainsString( 'href="https://shop.test/shop/"', $html, 'Nike is pressed, so its link clears the facet.' );
        self::assertStringContainsString( 'href="https://shop.test/shop/filter/brand/adidas/"', $html, 'Another value replaces the selection rather than stacking.' );
    }

    // ── per-facet class ──────────────────────────────────────────────────

    public function test_the_wrapper_gets_a_per_facet_class(): void {
        $html = Renderer::with_facet_class( $this->render( 'checkbox', [ 'style' => 'buttons' ] ), 'brand' );

        self::assertStringContainsString( 'class="hof-facet hof-facet-checkbox hof-facet--brand"', $html );
        self::assertSame( 1, substr_count( $html, 'hof-facet--brand' ), 'Only the wrapper is tagged.' );
    }

    public function test_the_per_facet_class_works_for_the_list_style_and_other_displays(): void {
        self::assertStringContainsString(
            'hof-facet--brand',
            Renderer::with_facet_class( $this->render( 'checkbox' ), 'brand' )
        );
        self::assertSame(
            '<div class="hof-facet hof-facet-range hof-facet--price" data-x="1"></div>',
            Renderer::with_facet_class( '<div class="hof-facet hof-facet-range" data-x="1"></div>', 'price' )
        );
    }

    public function test_the_per_facet_class_does_not_match_a_longer_class_name(): void {
        // hof-facet-checkbox alone is not the bare hof-facet token.
        self::assertSame(
            '<div class="hof-facet-checkbox"></div>',
            Renderer::with_facet_class( '<div class="hof-facet-checkbox"></div>', 'brand' )
        );
    }

    public function test_the_per_facet_class_strips_unsafe_characters_from_the_slug(): void {
        self::assertStringContainsString(
            'hof-facet--brandscript',
            Renderer::with_facet_class( '<div class="hof-facet"></div>', 'brand"><script' )
        );
    }

    public function test_an_empty_render_stays_empty(): void {
        self::assertSame( '', Renderer::with_facet_class( '', 'brand' ) );
    }

    // ── saving the settings ──────────────────────────────────────────────

    /** @return array<string, mixed> */
    private function sanitizedSettings( string $display, array $settings ): array {
        $controller = new RestController( new Resolver(), new Indexer() );
        $method     = new \ReflectionMethod( $controller, 'sanitize_settings' );
        $method->setAccessible( true );
        return $method->invoke( $controller, $settings, $display );
    }

    public function test_button_settings_are_kept_for_checkbox_and_radio(): void {
        $in = [ 'style' => 'buttons', 'button_shape' => 'square', 'button_fill' => 'tinted', 'button_count' => false, 'show_empty' => true ];

        self::assertSame( $in, $this->sanitizedSettings( 'checkbox', $in ) );
        self::assertSame( $in, $this->sanitizedSettings( 'radio', $in ) );
    }

    public function test_invalid_button_settings_are_dropped(): void {
        $out = $this->sanitizedSettings( 'checkbox', [ 'style' => 'chips', 'button_shape' => 'blob', 'button_fill' => 'neon' ] );

        self::assertSame( [], $out );
    }

    public function test_button_flags_accept_boolean_like_values(): void {
        $out = $this->sanitizedSettings( 'checkbox', [ 'button_count' => '0', 'show_empty' => 'true' ] );

        self::assertFalse( $out['button_count'] );
        self::assertTrue( $out['show_empty'] );
    }

    public function test_button_settings_are_not_stored_for_other_displays(): void {
        $out = $this->sanitizedSettings( 'dropdown', [ 'style' => 'buttons', 'match' => 'all' ] );

        self::assertSame( [ 'match' => 'all' ], $out );
    }

    public function test_button_settings_sit_alongside_match(): void {
        $out = $this->sanitizedSettings( 'checkbox', [ 'match' => 'all', 'style' => 'buttons' ] );

        self::assertSame( [ 'match' => 'all', 'style' => 'buttons' ], $out );
    }
}
