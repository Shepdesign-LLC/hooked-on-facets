<?php
/**
 * @package HookedOnFacets\Tests
 */

declare(strict_types=1);

namespace HookedOnFacets\Tests;

use Brain\Monkey;
use Brain\Monkey\Functions;
use HookedOnFacets\Facets\Renderer;
use HookedOnFacets\Filter\Resolver;
use PHPUnit\Framework\TestCase;

/**
 * The search facet's markup contract: the runtime finds the input by the
 * facet's data attributes, and the stylesheet centres the icon on the
 * field wrapper.
 */
final class RendererSearchTest extends TestCase {

    protected function setUp(): void {
        parent::setUp();
        Monkey\setUp();
        Functions\when( 'esc_attr' )->returnArg();
        Functions\when( 'esc_html' )->returnArg();
        Functions\when( 'esc_attr_e' )->alias( static function ( $s ) { echo $s; } );
    }

    protected function tearDown(): void {
        Monkey\tearDown();
        parent::tearDown();
    }

    private function render( string $value = '' ): string {
        $method = new \ReflectionMethod( Renderer::class, 'render_search' );
        return (string) $method->invoke(
            new Renderer( new Resolver() ),
            [ 'name' => 'title', 'label' => 'Search games' ],
            $value
        );
    }

    public function test_the_icon_and_input_share_one_field_wrapper(): void {
        $html = $this->render();

        self::assertMatchesRegularExpression(
            '#<span class="hof-facet-search-field">\s*<svg class="hof-facet-search-icon"[^>]*aria-hidden="true"[\s\S]*?</svg>\s*<input type="search"#',
            $html
        );
    }

    public function test_the_input_keeps_its_name_and_value(): void {
        $html = $this->render( 'metroid' );

        self::assertStringContainsString( 'name="hof[title]"', $html );
        self::assertStringContainsString( 'value="metroid"', $html );
        self::assertStringContainsString( 'data-hof-display="search"', $html );
    }
}
