<?php
/**
 * @package HookedOnFacets\Tests
 */

declare(strict_types=1);

namespace HookedOnFacets\Tests;

use Brain\Monkey;
use Brain\Monkey\Functions;
use HookedOnFacets\Admin\MenuRegistrar;
use PHPUnit\Framework\TestCase;

/**
 * The admin registers one top-level item and no submenu (the nine screens
 * live in the app's own rail), names itself in lowercase, and prints the
 * design tokens where they can actually override the bundle's defaults.
 */
final class MenuRegistrarTest extends TestCase {

    protected function setUp(): void {
        parent::setUp();
        Monkey\setUp();
        Functions\when( '__' )->returnArg();
        Functions\when( 'apply_filters' )->alias( static fn( $hook, $value ) => $value );
    }

    protected function tearDown(): void {
        Monkey\tearDown();
        parent::tearDown();
    }

    public function test_registers_exactly_one_top_level_menu_and_no_submenu(): void {
        $calls = [];
        Functions\when( 'add_menu_page' )->alias( static function ( ...$args ) use ( &$calls ) {
            $calls[] = $args;
            return 'toplevel_page_hooked-on-facets';
        } );
        Functions\expect( 'add_submenu_page' )->never();

        ( new MenuRegistrar() )->register_menu();

        self::assertCount( 1, $calls );
        self::assertSame( 'manage_options', $calls[0][2] );
        self::assertSame( 'hooked-on-facets', $calls[0][3] );
    }

    public function test_the_menu_names_the_plugin_in_lowercase(): void {
        $calls = [];
        Functions\when( 'add_menu_page' )->alias( static function ( ...$args ) use ( &$calls ) {
            $calls[] = $args;
            return '';
        } );

        ( new MenuRegistrar() )->register_menu();

        self::assertSame( 'hooked on facets', $calls[0][0], 'Page title' );
        self::assertSame( 'hooked on facets', $calls[0][1], 'Menu label' );
    }

    private function call( string $method, mixed ...$args ): mixed {
        $m = new \ReflectionMethod( MenuRegistrar::class, $method );
        $m->setAccessible( true );
        return $m->invoke( new MenuRegistrar(), ...$args );
    }

    public function test_default_tokens_carry_the_brand_palette(): void {
        $tokens = $this->call( 'css_tokens' );

        self::assertSame( '#534AB7', $tokens['--hof-primary'] );
        self::assertSame( '#FFFFFF', $tokens['--hof-on-primary'] );
        self::assertSame( '#F5F4FB', $tokens['--hof-bg'] );
        self::assertSame( '#DDDAEE', $tokens['--hof-border'] );
        self::assertSame( '#D85A30', $tokens['--hof-danger'] );
        self::assertStringStartsWith( "'Geist Variable'", $tokens['--hof-font'] );
    }

    public function test_the_token_block_targets_the_page_body_and_the_app_root(): void {
        $css = (string) $this->call( 'token_css_block', [ '--hof-primary' => '#123456' ] );

        self::assertStringStartsWith( 'body.toplevel_page_hooked-on-facets, .hof-admin, #hof-admin-root {', $css );
        self::assertStringContainsString( '--hof-primary: #123456;', $css );
    }

    public function test_the_token_block_strips_anything_that_could_break_out(): void {
        $css = (string) $this->call( 'token_css_block', [ '--hof-primary' => 'red; } body { display:none', 'bad key!' => '#fff' ] );

        self::assertStringNotContainsString( '}', substr( $css, strpos( $css, '{' ) + 1, -1 ) );
        self::assertStringNotContainsString( 'bad key!', $css );
        self::assertStringContainsString( '--hof-primary:', $css );
    }
}
