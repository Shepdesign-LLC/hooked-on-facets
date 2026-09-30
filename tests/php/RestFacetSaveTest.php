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
}
