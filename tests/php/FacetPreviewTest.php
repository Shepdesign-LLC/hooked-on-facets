<?php
/**
 * @package HookedOnFacets\Tests
 */

declare(strict_types=1);

namespace HookedOnFacets\Tests;

use HookedOnFacets\Api\FacetPreview;
use PHPUnit\Framework\TestCase;

/**
 * The preview builds the rows a facet would index and then answers three
 * questions over them: which values exist (with counts), which objects survive
 * a selection, and what the numeric bounds are. All pure, so no WordPress.
 */
final class FacetPreviewTest extends TestCase {

    /** @return array<string, mixed> */
    private function row( int $object, string $value, string $label = '', ?float $numeric = null, ?int $term = null, ?int $parent = null ): array {
        return [
            'object_id'     => $object,
            'facet_value'   => $value,
            'facet_display' => $label !== '' ? $label : ucfirst( $value ),
            'facet_numeric' => $numeric,
            'term_id'       => $term,
            'parent_id'     => $parent,
            'depth'         => $parent ? 1 : 0,
        ];
    }

    // ── aggregate ────────────────────────────────────────────────────────

    public function test_aggregate_counts_distinct_objects_per_value(): void {
        $out = FacetPreview::aggregate( [
            $this->row( 1, 'alder' ), $this->row( 2, 'alder' ), $this->row( 3, 'kestrel' ),
            $this->row( 2, 'alder' ), // duplicate row for one object must not double count
        ] );

        self::assertSame( [ 'alder', 2 ], [ $out[0]['value'], $out[0]['count'] ] );
        self::assertSame( [ 'kestrel', 1 ], [ $out[1]['value'], $out[1]['count'] ] );
    }

    public function test_aggregate_orders_by_count_then_label(): void {
        $out = FacetPreview::aggregate( [
            $this->row( 1, 'b' ), $this->row( 2, 'a' ), $this->row( 3, 'c' ), $this->row( 4, 'c' ),
        ] );

        self::assertSame( [ 'c', 'a', 'b' ], array_column( $out, 'value' ) );
    }

    // ── numeric bounds ───────────────────────────────────────────────────

    public function test_numeric_bounds_ignore_rows_without_a_numeric(): void {
        $out = FacetPreview::numeric_bounds( [
            $this->row( 1, '19', '19', 19.0 ), $this->row( 2, '349', '349', 349.0 ), $this->row( 3, 'x' ),
        ] );

        self::assertSame( [ 'min' => 19.0, 'max' => 349.0 ], $out );
    }

    public function test_numeric_bounds_are_null_when_nothing_is_numeric(): void {
        self::assertSame( [ 'min' => null, 'max' => null ], FacetPreview::numeric_bounds( [ $this->row( 1, 'a' ) ] ) );
    }

    // ── selection ────────────────────────────────────────────────────────

    public function test_normalize_selection_cleans_input(): void {
        $sel = FacetPreview::normalize_selection( [
            'values' => [ 'a', '', [ 'nested' ], 'a', 'b' ],
            'match'  => 'bogus',
            'min'    => '10',
            'max'    => 'nope',
            'q'      => '  ridge ',
        ] );

        self::assertSame( [ 'a', 'b' ], $sel['values'] );
        self::assertSame( 'any', $sel['match'] );
        self::assertSame( 10.0, $sel['min'] );
        self::assertNull( $sel['max'] );
        self::assertSame( 'ridge', $sel['q'] );
    }

    private function sel( array $over = [] ): array {
        return FacetPreview::normalize_selection( $over );
    }

    public function test_empty_selection_keeps_every_object(): void {
        $rows = [ $this->row( 1, 'a' ), $this->row( 2, 'b' ) ];

        self::assertSame( [ 1, 2, 3 ], FacetPreview::match_ids( $rows, [ 1, 2, 3 ], 'checkbox', $this->sel() ) );
    }

    public function test_any_matches_objects_with_at_least_one_picked_value(): void {
        $rows = [ $this->row( 1, 'a' ), $this->row( 2, 'b' ), $this->row( 3, 'c' ) ];
        $out  = FacetPreview::match_ids( $rows, [ 1, 2, 3, 4 ], 'checkbox', $this->sel( [ 'values' => [ 'a', 'b' ] ] ) );

        self::assertSame( [ 1, 2 ], $out, 'Object 4 has no rows and never matches a pick.' );
    }

    public function test_all_requires_every_picked_value(): void {
        $rows = [
            $this->row( 1, 'a' ), $this->row( 1, 'b' ),
            $this->row( 2, 'a' ),
        ];
        $out = FacetPreview::match_ids( $rows, [ 1, 2 ], 'checkbox', $this->sel( [ 'values' => [ 'a', 'b' ], 'match' => 'all' ] ) );

        self::assertSame( [ 1 ], $out );
    }

    public function test_range_filters_on_the_numeric(): void {
        $rows = [ $this->row( 1, '19', '19', 19.0 ), $this->row( 2, '189', '189', 189.0 ), $this->row( 3, '349', '349', 349.0 ) ];
        $out  = FacetPreview::match_ids( $rows, [ 1, 2, 3 ], 'range', $this->sel( [ 'max' => 200 ] ) );

        self::assertSame( [ 1, 2 ], $out );
        self::assertSame( [ 2, 3 ], FacetPreview::match_ids( $rows, [ 1, 2, 3 ], 'range', $this->sel( [ 'min' => 100 ] ) ) );
    }

    public function test_search_matches_the_indexed_text_case_insensitively(): void {
        $rows = [ $this->row( 1, 'Summit shell', 'Summit shell' ), $this->row( 2, 'Trail runner', 'Trail runner' ) ];
        $out  = FacetPreview::match_ids( $rows, [ 1, 2 ], 'search', $this->sel( [ 'q' => 'SHELL' ] ) );

        self::assertSame( [ 1 ], $out );
    }

    public function test_hierarchy_selecting_a_parent_includes_its_children(): void {
        $rows = [
            $this->row( 1, 'apparel', 'Apparel', null, 10, null ),
            $this->row( 2, 'jackets', 'Jackets', null, 11, 10 ),
            $this->row( 3, 'footwear', 'Footwear', null, 20, null ),
        ];
        $out = FacetPreview::match_ids( $rows, [ 1, 2, 3 ], 'hierarchy', $this->sel( [ 'values' => [ 'apparel' ] ] ) );

        self::assertSame( [ 1, 2 ], $out );
    }

    public function test_hierarchy_selecting_a_child_does_not_include_the_parent(): void {
        $rows = [
            $this->row( 1, 'apparel', 'Apparel', null, 10, null ),
            $this->row( 2, 'jackets', 'Jackets', null, 11, 10 ),
        ];

        self::assertSame( [ 2 ], FacetPreview::match_ids( $rows, [ 1, 2 ], 'hierarchy', $this->sel( [ 'values' => [ 'jackets' ] ] ) ) );
    }

    public function test_toggle_matches_the_configured_true_value(): void {
        $rows  = [ $this->row( 1, 'instock' ), $this->row( 2, 'outofstock' ) ];
        $facet = [ 'settings' => [ 'true_value' => 'instock' ] ];
        $out   = FacetPreview::match_ids( $rows, [ 1, 2 ], 'toggle', $this->sel( [ 'values' => [ 'on' ] ] ), $facet );

        self::assertSame( [ 1 ], $out );
    }
}
