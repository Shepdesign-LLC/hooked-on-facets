<?php
/**
 * FacetPreview — runs an unsaved facet definition against real content.
 *
 * Powers the editor's live preview. The index is keyed by saved facet name, so
 * an unsaved facet has no rows yet. Instead this builds the rows the facet
 * WOULD index (same builders as a real reindex, in memory, never written),
 * then aggregates values, applies a selection and hydrates a page of results.
 *
 * @package HookedOnFacets
 */

declare(strict_types=1);

namespace HookedOnFacets\Api;

use HookedOnFacets\Admin\SwatchTermFields;
use HookedOnFacets\Indexer;

defined( 'ABSPATH' ) || exit;

final class FacetPreview {

    /** Objects the preview builds rows for. Beyond this it samples and says so. */
    public const OBJECT_CAP = 5000;

    public function __construct( private readonly Indexer $indexer ) {}

    /**
     * @param array<string, mixed> $facet     Sanitized facet definition.
     * @param array<string, mixed> $selection { values: string[], match: any|all, min, max, q }
     * @return array<string, mixed>
     */
    public function run( array $facet, array $selection = [], int $limit = 12 ): array {
        global $wpdb;
        $started = microtime( true );

        $post_type = (string) ( $facet['post_type'] ?? '' );
        if ( $post_type === '' || ! post_type_exists( $post_type ) ) {
            $post_type = post_type_exists( 'product' ) ? 'product' : 'post';
        }
        $obj  = get_post_type_object( $post_type );
        $noun = is_object( $obj ) && isset( $obj->labels->name ) ? strtolower( (string) $obj->labels->name ) : $post_type;

        $total = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_status = 'publish' AND post_type = %s",
            $post_type
        ) );
        $ids = array_map( 'intval', (array) $wpdb->get_col( $wpdb->prepare(
            "SELECT ID FROM {$wpdb->posts} WHERE post_status = 'publish' AND post_type = %s ORDER BY ID DESC LIMIT %d",
            $post_type,
            self::OBJECT_CAP
        ) ) );

        $rows      = $this->indexer->preview_rows( $facet, $ids );
        $kind      = (string) ( $facet['kind'] ?? '' );
        $display   = (string) ( $facet['display'] ?? '' );
        // Range and search read the rows directly; a list of every distinct
        // price or title would only bloat the response.
        $values    = in_array( $display, [ 'range', 'date_range', 'search' ], true ) ? [] : self::aggregate( $rows );
        $numerics  = self::numeric_bounds( $rows );
        $selection = self::normalize_selection( $selection );

        // A taxonomy facet also shows terms nothing is filed under yet, so
        // "show values with no results" has something to show.
        if ( $kind === 'taxonomy' && ! empty( $facet['source'] ) ) {
            $values = self::with_empty_terms( $values, (string) $facet['source'] );
        }
        if ( in_array( $display, [ 'swatch', 'swiper' ], true ) ) {
            $values = self::with_colors( $values );
        }

        $matching = self::match_ids( $rows, $ids, $display, $selection, $facet );

        return [
            'post_type' => [ 'slug' => $post_type, 'label' => $noun ],
            'values'    => $values,
            'bounds'    => $numerics,
            'total'     => $total,
            'count'     => count( $matching ),
            'sampled'   => $total > count( $ids ),
            'items'     => $this->items( $matching, $rows, $limit ),
            'ms'        => round( ( microtime( true ) - $started ) * 1000, 1 ),
        ];
    }

    /**
     * Group rows by value: how many distinct objects carry each.
     *
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array<string, mixed>>
     */
    public static function aggregate( array $rows ): array {
        $by = [];
        foreach ( $rows as $r ) {
            $v = (string) $r['facet_value'];
            if ( ! isset( $by[ $v ] ) ) {
                $by[ $v ] = [
                    'value'     => $v,
                    'label'     => (string) $r['facet_display'],
                    'term_id'   => $r['term_id'] ?? null,
                    'parent_id' => $r['parent_id'] ?? null,
                    'depth'     => (int) ( $r['depth'] ?? 0 ),
                    'objects'   => [],
                ];
            }
            $by[ $v ]['objects'][ (int) $r['object_id'] ] = true;
        }

        $out = [];
        foreach ( $by as $v ) {
            $out[] = [
                'value'     => $v['value'],
                'label'     => $v['label'],
                'count'     => count( $v['objects'] ),
                'term_id'   => $v['term_id'] !== null ? (int) $v['term_id'] : null,
                'parent_id' => $v['parent_id'] !== null ? (int) $v['parent_id'] : null,
                'depth'     => $v['depth'],
            ];
        }
        usort( $out, static function ( array $a, array $b ): int {
            return $b['count'] <=> $a['count'] ?: strcmp( $a['label'], $b['label'] );
        } );
        return $out;
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array{min: ?float, max: ?float}
     */
    public static function numeric_bounds( array $rows ): array {
        $min = null;
        $max = null;
        foreach ( $rows as $r ) {
            if ( $r['facet_numeric'] === null ) {
                continue;
            }
            $n   = (float) $r['facet_numeric'];
            $min = $min === null ? $n : min( $min, $n );
            $max = $max === null ? $n : max( $max, $n );
        }
        return [ 'min' => $min, 'max' => $max ];
    }

    /**
     * @param array<string, mixed> $raw
     * @return array{values: string[], match: string, min: ?float, max: ?float, q: string}
     */
    public static function normalize_selection( array $raw ): array {
        $values = [];
        foreach ( (array) ( $raw['values'] ?? [] ) as $v ) {
            if ( is_scalar( $v ) && (string) $v !== '' ) {
                $values[] = (string) $v;
            }
        }
        return [
            'values' => array_values( array_unique( $values ) ),
            'match'  => ( $raw['match'] ?? 'any' ) === 'all' ? 'all' : 'any',
            'min'    => isset( $raw['min'] ) && is_numeric( $raw['min'] ) ? (float) $raw['min'] : null,
            'max'    => isset( $raw['max'] ) && is_numeric( $raw['max'] ) ? (float) $raw['max'] : null,
            'q'      => isset( $raw['q'] ) && is_scalar( $raw['q'] ) ? trim( (string) $raw['q'] ) : '',
        ];
    }

    /**
     * Which of $all_ids the selection leaves in. An empty selection keeps all.
     *
     * @param array<int, array<string, mixed>> $rows
     * @param int[]                            $all_ids
     * @param array<string, mixed>             $selection normalize_selection() output
     * @param array<string, mixed>             $facet
     * @return int[]
     */
    public static function match_ids( array $rows, array $all_ids, string $display, array $selection, array $facet = [] ): array {
        if ( in_array( $display, [ 'range', 'date_range' ], true ) ) {
            if ( $selection['min'] === null && $selection['max'] === null ) {
                return $all_ids;
            }
            $hit = [];
            foreach ( $rows as $r ) {
                if ( $r['facet_numeric'] === null ) {
                    continue;
                }
                $n = (float) $r['facet_numeric'];
                if ( ( $selection['min'] === null || $n >= $selection['min'] ) && ( $selection['max'] === null || $n <= $selection['max'] ) ) {
                    $hit[ (int) $r['object_id'] ] = true;
                }
            }
            return self::keep( $all_ids, $hit );
        }

        if ( $display === 'search' ) {
            if ( $selection['q'] === '' ) {
                return $all_ids;
            }
            $needle = strtolower( $selection['q'] );
            $hit    = [];
            foreach ( $rows as $r ) {
                if ( str_contains( strtolower( (string) $r['facet_display'] ), $needle ) ) {
                    $hit[ (int) $r['object_id'] ] = true;
                }
            }
            return self::keep( $all_ids, $hit );
        }

        $picked = $selection['values'];
        if ( $display === 'toggle' ) {
            $true = (string) ( $facet['settings']['true_value'] ?? '1' );
            $picked = $picked === [] ? [] : [ $true ];
        }
        if ( $picked === [] ) {
            return $all_ids;
        }

        // Selecting a parent term also selects everything nested under it.
        $expanded = [];
        if ( $display === 'hierarchy' ) {
            $expanded = self::expand_descendants( $rows, $picked );
        }

        $by_object = [];
        foreach ( $rows as $r ) {
            $by_object[ (int) $r['object_id'] ][ (string) $r['facet_value'] ] = true;
        }

        $hit = [];
        foreach ( $by_object as $object_id => $has ) {
            if ( $selection['match'] === 'all' && $display !== 'hierarchy' ) {
                if ( count( array_diff( $picked, array_keys( $has ) ) ) === 0 ) {
                    $hit[ $object_id ] = true;
                }
                continue;
            }
            $wanted = $display === 'hierarchy' ? $expanded : array_fill_keys( $picked, true );
            if ( array_intersect_key( $has, $wanted ) !== [] ) {
                $hit[ $object_id ] = true;
            }
        }
        return self::keep( $all_ids, $hit );
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @param string[]                         $picked term slugs
     * @return array<string, true> slugs of the picked terms and all their descendants
     */
    private static function expand_descendants( array $rows, array $picked ): array {
        $slug_by_id = [];
        $parent_of  = [];
        foreach ( $rows as $r ) {
            if ( $r['term_id'] === null ) {
                continue;
            }
            $slug_by_id[ (int) $r['term_id'] ] = (string) $r['facet_value'];
            $parent_of[ (int) $r['term_id'] ]  = (int) ( $r['parent_id'] ?? 0 );
        }
        $picked_ids = [];
        foreach ( $slug_by_id as $id => $slug ) {
            if ( in_array( $slug, $picked, true ) ) {
                $picked_ids[ $id ] = true;
            }
        }
        $out = array_fill_keys( $picked, true );
        foreach ( $parent_of as $id => $_parent ) {
            $cursor = $id;
            for ( $guard = 0; $cursor && $guard < 20; $guard++ ) {
                if ( isset( $picked_ids[ $cursor ] ) ) {
                    $out[ $slug_by_id[ $id ] ] = true;
                    break;
                }
                $cursor = $parent_of[ $cursor ] ?? 0;
            }
        }
        return $out;
    }

    /**
     * @param int[]             $all_ids
     * @param array<int, true>  $hit
     * @return int[]
     */
    private static function keep( array $all_ids, array $hit ): array {
        return array_values( array_filter( $all_ids, static fn( int $id ): bool => isset( $hit[ $id ] ) ) );
    }

    /**
     * @param array<int, array<string, mixed>> $values
     * @return array<int, array<string, mixed>>
     */
    private static function with_empty_terms( array $values, string $taxonomy ): array {
        if ( ! function_exists( 'get_terms' ) ) {
            return $values;
        }
        $terms = get_terms( [ 'taxonomy' => $taxonomy, 'hide_empty' => false, 'number' => 500 ] );
        if ( ! is_array( $terms ) ) {
            return $values;
        }
        $have = array_column( $values, 'value' );
        foreach ( $terms as $t ) {
            if ( ! is_object( $t ) || in_array( (string) $t->slug, $have, true ) ) {
                continue;
            }
            $values[] = [
                'value'     => (string) $t->slug,
                'label'     => (string) $t->name,
                'count'     => 0,
                'term_id'   => (int) $t->term_id,
                'parent_id' => ( (int) $t->parent ) ?: null,
                'depth'     => 0,
            ];
        }
        return $values;
    }

    /**
     * @param array<int, array<string, mixed>> $values
     * @return array<int, array<string, mixed>>
     */
    private static function with_colors( array $values ): array {
        foreach ( $values as $i => $v ) {
            if ( ! empty( $v['term_id'] ) ) {
                $color = (string) get_term_meta( (int) $v['term_id'], SwatchTermFields::META_COLOR, true );
                if ( $color !== '' ) {
                    $values[ $i ]['color'] = $color;
                }
            }
        }
        return $values;
    }

    /**
     * Hydrate the first $limit matching objects for the result grid.
     *
     * @param int[]                            $matching
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array{id: int, title: string, image: string, meta: string}>
     */
    private function items( array $matching, array $rows, int $limit ): array {
        global $wpdb;
        if ( $matching === [] ) {
            return [];
        }
        $ids          = array_slice( $matching, 0, $limit );
        $placeholders = implode( ', ', array_fill( 0, count( $ids ), '%d' ) );
        $posts        = (array) $wpdb->get_results( $wpdb->prepare(
            "SELECT ID, post_title FROM {$wpdb->posts} WHERE ID IN ({$placeholders}) ORDER BY post_date DESC",
            $ids
        ), ARRAY_A );

        $labels = [];
        foreach ( $rows as $r ) {
            $labels[ (int) $r['object_id'] ][] = (string) $r['facet_display'];
        }

        $out = [];
        foreach ( $posts as $p ) {
            $id    = (int) $p['ID'];
            $image = function_exists( 'get_the_post_thumbnail_url' ) ? get_the_post_thumbnail_url( $id, 'thumbnail' ) : '';
            $out[] = [
                'id'    => $id,
                'title' => (string) $p['post_title'],
                'image' => is_string( $image ) ? $image : '',
                'meta'  => implode( ', ', array_slice( $labels[ $id ] ?? [], 0, 3 ) ),
            ];
        }
        return $out;
    }
}
