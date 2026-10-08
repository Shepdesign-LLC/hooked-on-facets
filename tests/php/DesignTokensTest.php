<?php
/**
 * @package HookedOnFacets\Tests
 */

declare(strict_types=1);

namespace HookedOnFacets\Tests;

use Brain\Monkey;
use Brain\Monkey\Functions;
use HookedOnFacets\Design\DesignTokens;
use PHPUnit\Framework\TestCase;

/**
 * The design tokens and site CSS that the admin saves and the front end
 * prints. The CSS sanitizer is the security boundary, so it is tested against
 * the ways people try to get past one.
 */
final class DesignTokensTest extends TestCase {

    /** @var array<string, mixed> */
    private array $options = [];

    protected function setUp(): void {
        parent::setUp();
        Monkey\setUp();
        $this->options = [];
        Functions\when( 'get_option' )->alias( fn( $name, $default = false ) => $this->options[ $name ] ?? $default );
        Functions\when( 'update_option' )->alias( function ( $name, $value ) {
            $this->options[ $name ] = $value;
            return true;
        } );
    }

    protected function tearDown(): void {
        Monkey\tearDown();
        parent::tearDown();
    }

    // ── sanitize_css: what must be removed ───────────────────────────────

    /** @return array<string, array{string, string}> */
    public static function unsafeCss(): array {
        return [
            'less-than'                => [ '.a::after{content:"</style><script>alert(1)</script>"}', '.a::after{content:"/style>script>alert(1)/script>"}' ],
            '@import url'              => [ '@import url("x.css"); .a{color:red}', '.a{color:red}' ],
            '@import string'           => [ "@import 'x.css';\n.a{color:red}", '.a{color:red}' ],
            '@import uppercase'        => [ '@IMPORT "x.css"; .a{color:red}', '.a{color:red}' ],
            'expression'               => [ '.a{width:expression(alert(1));color:red}', '.a{color:red}' ],
            'expression last decl'     => [ '.a{color:red;width:expression(1)}', '.a{color:red;}' ],
            'expression with spaces'   => [ '.a{width:EXPRESSION ( 1 );color:red}', '.a{color:red}' ],
            'javascript url'           => [ '.a{background:url(javascript:alert(1));color:red}', '.a{color:red}' ],
            'quoted javascript url'    => [ '.a{background:url("javascript:alert(1)");color:red}', '.a{color:red}' ],
            'relative url'             => [ '.a{background:url(/img.png);color:red}', '.a{color:red}' ],
            'protocol-relative url'    => [ '.a{background:url(//evil.test/x.png);color:red}', '.a{color:red}' ],
            'data url'                 => [ '.a{background:url(data:image/png;base64,AAAA);color:red}', '.a{color:red}' ],
            'ftp url'                  => [ '.a{background:url(ftp://x/y.png);color:red}', '.a{color:red}' ],
            'one good url, one bad'    => [ '.a{background:url(https://x/y.png),url(/z.png);color:red}', '.a{color:red}' ],
            'css escape for url'       => [ '.a{background:\75rl(javascript:alert(1));color:red}', '.a{color:red}' ],
            'padded escape for url'    => [ '.a{background:\000075rl(x.png);color:red}', '.a{color:red}' ],
            'comment split url'        => [ '.a{background:ur/**/l(javascript:x);color:red}', '.a{color:red}' ],
            'behavior'                 => [ '.a{behavior:url(x.htc);color:red}', '.a{color:red}' ],
            '-moz-binding'             => [ '.a{-moz-binding:url(x);color:red}', '.a{color:red}' ],
            'javascript: elsewhere'    => [ '.a{x:javascript:foo();color:red}', '.a{color:red}' ],
            'vbscript'                 => [ '.a{x:vbscript:foo;color:red}', '.a{color:red}' ],
            'null byte in the middle'  => [ ".a{background:ur\0l(javascript:x);color:red}", '.a{color:red}' ],
            'unsafe inside @media'     => [ '@media (min-width:1px){.a{background:url(/x.png);color:red}}', '@media (min-width:1px){.a{color:red}}' ],
        ];
    }

    /**
     * @dataProvider unsafeCss
     */
    public function test_unsafe_css_is_removed( string $input, string $expected ): void {
        self::assertSame( $expected, DesignTokens::sanitize_css( $input ) );
    }

    // ── sanitize_css: what must survive ──────────────────────────────────

    /** @return array<string, array{string}> */
    public static function safeCss(): array {
        return [
            'plain rule'              => [ '.hof-btn{text-transform:uppercase;letter-spacing:.04em}' ],
            'child combinator'        => [ '.a > .b{color:red}' ],
            'sibling combinators'     => [ '.a + .b ~ .c{color:red}' ],
            'https url'               => [ '.a{background:url(https://cdn.example/y.png)}' ],
            'http url quoted'         => [ '.a{background:url("http://cdn.example/y.png")}' ],
            'uppercase https url'     => [ '.a{background:URL( HTTPS://cdn.example/y.png )}' ],
            'font-face with https'    => [ '@font-face{font-family:X;src:url(https://x/y.woff2)}' ],
            'legit css escape'        => [ '.a::before{content:"\201C"}' ],
            'attribute selector'      => [ '.a[data-x="y"]{color:red}' ],
            'custom property'         => [ '.a{--x:1px;width:var(--x)}' ],
            'media query'             => [ '@media (max-width:600px){.a{color:red}}' ],
            'keyframes'               => [ '@keyframes p{from{opacity:0}to{opacity:1}}' ],
            'important'               => [ '.a{color:red !important}' ],
            'color-mix'               => [ '.a{background:color-mix(in srgb,var(--hof-primary) 10%,transparent)}' ],
            'semicolon inside string' => [ '.a::after{content:"a;b"}' ],
        ];
    }

    /**
     * @dataProvider safeCss
     */
    public function test_ordinary_css_is_kept_exactly( string $css ): void {
        self::assertSame( $css, DesignTokens::sanitize_css( $css ) );
    }

    public function test_comments_are_stripped(): void {
        self::assertSame( '.a{color:red}', DesignTokens::sanitize_css( '/* note */.a{color:red}/* end */' ) );
    }

    public function test_a_rule_keeps_its_safe_declarations_when_one_is_dropped(): void {
        $out = DesignTokens::sanitize_css( ".a{color:red;background:url(/x.png);border:1px solid blue}\n.b{margin:0}" );

        self::assertSame( ".a{color:red;border:1px solid blue}\n.b{margin:0}", $out );
    }

    public function test_css_is_capped_in_size(): void {
        $out = DesignTokens::sanitize_css( str_repeat( '.a{color:red}', 5000 ) );

        self::assertLessThanOrEqual( DesignTokens::MAX_CSS_BYTES, strlen( $out ) );
    }

    public function test_sanitizing_twice_changes_nothing(): void {
        foreach ( array_merge( self::unsafeCss(), self::safeCss() ) as [ $input ] ) {
            $once = DesignTokens::sanitize_css( $input );
            self::assertSame( $once, DesignTokens::sanitize_css( $once ) );
        }
    }

    // ── token values ─────────────────────────────────────────────────────

    /** @return array<string, array{string, string}> */
    public static function tokenValues(): array {
        return [
            'hex'                => [ '#534AB7', '#534AB7' ],
            'rgb'                => [ 'rgb(1, 2, 3)', 'rgb(1, 2, 3)' ],
            'length'             => [ '6px', '6px' ],
            'var reference'      => [ 'var(--hof-accent)', 'var(--hof-accent)' ],
            'font stack'         => [ '"Geist", system-ui, sans-serif', '"Geist", system-ui, sans-serif' ],
            'mono stack'         => [ 'ui-monospace, "SF Mono", Menlo, monospace', 'ui-monospace, "SF Mono", Menlo, monospace' ],
            'inherit'            => [ 'inherit', 'inherit' ],
            'trimmed'            => [ '  #fff  ', '#fff' ],
            'declaration escape' => [ 'red; } body { display:none', '' ],
            'closing brace'      => [ 'red}', '' ],
            'url'                => [ 'url(https://x/y.png)', '' ],
            'expression'         => [ 'expression(1)', '' ],
            'javascript'         => [ 'javascript:alert(1)', '' ],
            'html'               => [ '<script>', '' ],
            'backslash'          => [ 'red\\', '' ],
            'empty'              => [ '', '' ],
            'too long'           => [ str_repeat( 'a', 201 ), '' ],
        ];
    }

    /**
     * @dataProvider tokenValues
     */
    public function test_token_values( string $input, string $expected ): void {
        self::assertSame( $expected, DesignTokens::sanitize_value( $input ) );
    }

    // ── sanitize() / save() ──────────────────────────────────────────────

    public function test_only_hof_tokens_with_valid_names_are_kept(): void {
        $out = DesignTokens::sanitize( [ 'tokens' => [
            '--hof-primary' => '#123456',
            '--HOF-Text'    => '#000000',
            '--evil'        => 'red',
            'hof-primary'   => 'red',
            '--hof-x y'     => 'red',
            '--hof-bad'     => 'red; }',
        ] ] );

        self::assertSame( [ '--hof-primary' => '#123456', '--hof-text' => '#000000' ], $out['tokens'] );
    }

    public function test_scope_needs_a_facet(): void {
        self::assertSame( 'site', DesignTokens::sanitize( [ 'scope' => 'facet' ] )['scope'] );
        self::assertSame( 'facet', DesignTokens::sanitize( [ 'scope' => 'facet', 'facet' => 'brand' ] )['scope'] );
        self::assertSame( 'site', DesignTokens::sanitize( [ 'scope' => 'bogus', 'facet' => 'brand' ] )['scope'] );
    }

    public function test_the_facet_slug_is_cleaned(): void {
        self::assertSame( 'brandscript', DesignTokens::sanitize( [ 'facet' => 'Brand"><script' ] )['facet'] );
    }

    public function test_save_stores_the_sanitized_payload_beside_the_token_values(): void {
        $out = DesignTokens::save( [
            'tokens'     => [ '--hof-primary' => '#D85A30' ],
            'custom_css' => '.hof-btn{text-transform:uppercase;background:url(/x.png)}',
            'scope'      => 'facet',
            'facet'      => 'brand',
        ] );

        self::assertSame(
            [
                'tokens'     => [ '--hof-primary' => '#D85A30' ],
                'custom_css' => '.hof-btn{text-transform:uppercase;}',
                'scope'      => 'facet',
                'facet'      => 'brand',
            ],
            $this->options[ DesignTokens::OPTION ],
            'Tokens and custom CSS live together in the hof_tokens option.'
        );
        self::assertSame( '#D85A30', $out['tokens']['--hof-primary'] );
    }

    // ── reading ──────────────────────────────────────────────────────────

    public function test_the_brand_set_is_shared_and_complete(): void {
        $brand = DesignTokens::brand();

        self::assertCount( 14, $brand );
        self::assertSame( '#534AB7', $brand['--hof-primary'] );
        self::assertSame( '#FFFFFF', $brand['--hof-on-primary'] );
        self::assertSame( '6px', $brand['--hof-radius-sm'] );
        self::assertSame( '8px', $brand['--hof-radius-md'] );
        foreach ( array_keys( $brand ) as $name ) {
            self::assertArrayHasKey( $name, DesignTokens::defaults(), "$name needs a default so the editor has a starting value." );
        }
    }

    public function test_front_end_color_defaults_are_the_brand_set(): void {
        $brand    = DesignTokens::brand();
        $defaults = DesignTokens::defaults();

        foreach ( [ '--hof-primary', '--hof-on-primary', '--hof-surface', '--hof-bg', '--hof-border', '--hof-text', '--hof-muted' ] as $name ) {
            self::assertSame( $brand[ $name ], $defaults[ $name ], "$name must default to brand." );
        }
        self::assertSame( '#534AB7', $defaults['--hof-primary'], 'Hook purple, not the legacy blue.' );
        self::assertSame( $brand['--hof-danger'], $defaults['--hof-accent'] );
    }

    public function test_storefront_defaults_are_quiet_and_neutral(): void {
        $defaults = DesignTokens::defaults();

        // Sentence-case facet titles, not small letter-spaced capitals.
        self::assertSame( 'none', $defaults['--hof-label-transform'] );
        self::assertSame( 'normal', $defaults['--hof-label-letter-spacing'] );
        // 0.5px hairlines vanish or blur on 1x screens.
        self::assertSame( '1px', $defaults['--hof-input-border-w'] );

        // Text and neutrals are warm gray: blue must not lead red/green by
        // more than a hair, or the storefront reads cool-lavender again.
        foreach ( [ '--hof-text', '--hof-muted', '--hof-bg', '--hof-border' ] as $name ) {
            [ $r, $g, $b ] = sscanf( $defaults[ $name ], '#%02x%02x%02x' );
            self::assertLessThanOrEqual( 2, $b - min( $r, $g ), "$name should be a warm neutral" );
        }
    }

    public function test_nothing_saved_reads_as_the_current_defaults(): void {
        $out = DesignTokens::get();

        self::assertSame( DesignTokens::defaults()['--hof-primary'], $out['tokens']['--hof-primary'] );
        self::assertSame( '', $out['custom_css'] );
        self::assertSame( 'site', $out['scope'] );
        self::assertSame( [], DesignTokens::saved_overrides() );
        self::assertSame( '', DesignTokens::public_css() );
    }

    public function test_saved_values_win_over_the_defaults_and_only_they_are_overrides(): void {
        DesignTokens::save( [ 'tokens' => [ '--hof-primary' => '#00AA00' ] ] );

        self::assertSame( '#00AA00', DesignTokens::get()['tokens']['--hof-primary'] );
        self::assertSame( DesignTokens::defaults()['--hof-radius-md'], DesignTokens::get()['tokens']['--hof-radius-md'] );
        self::assertSame( [ '--hof-primary' => '#00AA00' ], DesignTokens::saved_overrides() );
    }

    public function test_the_editor_gets_the_brand_set_to_reset_to(): void {
        self::assertSame( DesignTokens::brand(), DesignTokens::get()['brand'] );
    }

    public function test_a_hostile_stored_option_is_cleaned_on_the_way_out(): void {
        // Whatever wrote the option, the front end never prints raw values.
        $this->options[ DesignTokens::OPTION ] = [
            'tokens'     => [ '--hof-primary' => 'red; } body { display:none' ],
            'custom_css' => '.a{background:url(javascript:x);color:red}</style><script>',
        ];

        self::assertSame( [], DesignTokens::saved_overrides() );
        self::assertSame( '.a{color:red}/style>script>', DesignTokens::public_css() );
    }

    public function test_admin_only_follows_the_accent_tokens(): void {
        self::assertContains( '--hof-primary', DesignTokens::ADMIN_TOKENS );
        self::assertContains( '--hof-danger', DesignTokens::ADMIN_TOKENS );
        self::assertNotContains( '--hof-bg', DesignTokens::ADMIN_TOKENS );
        self::assertNotContains( '--hof-text', DesignTokens::ADMIN_TOKENS );
        self::assertNotContains( '--hof-space', DesignTokens::ADMIN_TOKENS );
        self::assertNotContains( '--hof-radius-md', DesignTokens::ADMIN_TOKENS );
        self::assertNotContains( '--hof-font-body', DesignTokens::ADMIN_TOKENS );
    }

    // ── printing ─────────────────────────────────────────────────────────

    public function test_site_scope_prints_the_css_as_written(): void {
        DesignTokens::save( [ 'custom_css' => '.hof-btn{text-transform:uppercase}', 'scope' => 'site' ] );

        self::assertSame( '.hof-btn{text-transform:uppercase}', DesignTokens::public_css() );
    }

    public function test_facet_scope_prefixes_every_selector(): void {
        DesignTokens::save( [ 'custom_css' => '.hof-btn{text-transform:uppercase}', 'scope' => 'facet', 'facet' => 'brand' ] );

        self::assertSame( '.hof-facet--brand .hof-btn{text-transform:uppercase}', DesignTokens::public_css() );
    }

    // ── scope_css, against the fixtures the JS preview also uses ─────────

    /** @return array<string, array{string, string, string}> */
    public static function scopeCases(): array {
        $fixtures = json_decode( (string) file_get_contents( __DIR__ . '/../fixtures/custom-css.json' ), true );
        $out      = [];
        foreach ( $fixtures['scope'] as $case ) {
            $out[ $case['name'] ] = [ $case['slug'], $case['input'], $case['expected'] ];
        }
        return $out;
    }

    /**
     * @dataProvider scopeCases
     */
    public function test_scope_css( string $slug, string $input, string $expected ): void {
        self::assertSame( $expected, DesignTokens::scope_css( $input, $slug ) );
    }
}
