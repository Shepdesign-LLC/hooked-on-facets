<?php
/**
 * IndexerStats — the read model behind GET /indexer/stats.
 *
 * Feeds the admin Facets list: indexed item counts per post type, and per
 * facet the distinct-value count, which post type it belongs to, and whether
 * a background job is (re)building it right now.
 *
 * @package HookedOnFacets
 */

declare(strict_types=1);

namespace HookedOnFacets\Api;

use HookedOnFacets\Activator;
use HookedOnFacets\Indexer;

defined( 'ABSPATH' ) || exit;

final class IndexerStats {

    public const STATUS_INDEXED  = 'indexed';
    public const STATUS_INDEXING = 'indexing';
    public const STATUS_PENDING  = 'pending';

    public function __construct( private readonly Indexer $indexer ) {}

    /**
     * @param array<int, array<string, mixed>> $facets Configured facet definitions.
     * @return array{
     *   post_types: array<int, array{slug: string, label: string, items: int, custom: bool}>,
     *   registered_post_types: int,
     *   totals: array{rows: int, objects: int},
     *   facets: array<string, array{values: int, rows: int, objects: int, post_type: string, status: string}>,
     *   background: array<string, mixed>
     * }
     */
    public function snapshot( array $facets ): array {
        global $wpdb;
        $table = $wpdb->prefix . Activator::TABLE;

        $background = $this->indexer->background_state();
        $running    = ! empty( $background['running'] );

        $per_facet = [];
        $raw       = $wpdb->get_results(
            "SELECT facet_name AS name,
                    COUNT(*) AS rows_n,
                    COUNT(DISTINCT facet_value) AS values_n,
                    COUNT(DISTINCT object_id) AS objects_n
             FROM {$table}
             GROUP BY facet_name",
            ARRAY_A
        );
        foreach ( (array) $raw as $r ) {
            $per_facet[ (string) $r['name'] ] = [
                'rows'    => (int) $r['rows_n'],
                'values'  => (int) $r['values_n'],
                'objects' => (int) $r['objects_n'],
            ];
        }

        $dominant = self::dominant_post_types( (array) $wpdb->get_results(
            "SELECT i.facet_name AS facet, p.post_type AS post_type, COUNT(DISTINCT i.object_id) AS n
             FROM {$table} i
             INNER JOIN {$wpdb->posts} p ON p.ID = i.object_id
             WHERE i.object_type = 'post'
             GROUP BY i.facet_name, p.post_type",
            ARRAY_A
        ) );

        $out = [];
        foreach ( $facets as $facet ) {
            if ( ! is_array( $facet ) || empty( $facet['name'] ) ) {
                continue;
            }
            $name  = (string) $facet['name'];
            $stats = $per_facet[ $name ] ?? [ 'rows' => 0, 'values' => 0, 'objects' => 0 ];

            $out[ $name ] = [
                'values'    => $stats['values'],
                'rows'      => $stats['rows'],
                'objects'   => $stats['objects'],
                'post_type' => self::resolve_post_type( $facet, $dominant[ $name ] ?? '', 'get_taxonomy' ),
                'status'    => self::status_for( $stats['rows'], $running, ( $facet['kind'] ?? '' ) !== 'view' ),
            ];
        }

        $totals = (array) $wpdb->get_row(
            "SELECT COUNT(*) AS rows_n, COUNT(DISTINCT object_id) AS objects_n FROM {$table}",
            ARRAY_A
        );

        return [
            'post_types'            => $this->post_types(),
            // How many post types exist to index, for "3 of 5".
            'registered_post_types' => function_exists( 'get_post_types' )
                ? count( (array) get_post_types( [ 'public' => true ], 'names' ) )
                : 0,
            'totals'                => [
                'rows'    => (int) ( $totals['rows_n'] ?? 0 ),
                'objects' => (int) ( $totals['objects_n'] ?? 0 ),
            ],
            'facets'                => $out,
            'background'            => $background,
        ];
    }

    /**
     * Which post type a facet belongs to. An explicit `post_type` on the
     * definition wins, then the post type that owns most of the facet's
     * indexed rows, then the taxonomy's first registered object type.
     *
     * @param array<string, mixed> $facet
     * @param callable             $taxonomy_lookup get_taxonomy() or a stand-in.
     */
    public static function resolve_post_type( array $facet, string $dominant, callable $taxonomy_lookup ): string {
        $explicit = isset( $facet['post_type'] ) ? sanitize_key( (string) $facet['post_type'] ) : '';
        if ( $explicit !== '' ) {
            return $explicit;
        }
        if ( $dominant !== '' ) {
            return $dominant;
        }
        if ( ( $facet['kind'] ?? '' ) === 'taxonomy' && ! empty( $facet['source'] ) ) {
            $tax = $taxonomy_lookup( (string) $facet['source'] );
            if ( is_object( $tax ) && ! empty( $tax->object_type ) && is_array( $tax->object_type ) ) {
                return (string) reset( $tax->object_type );
            }
        }
        return '';
    }

    /**
     * Collapse (facet, post_type, n) rows to the post type with the most
     * objects per facet. Ties break alphabetically so the answer is stable.
     *
     * @param array<int, array<string, mixed>> $rows
     * @return array<string, string> facet name => post type slug
     */
    public static function dominant_post_types( array $rows ): array {
        $best = [];
        foreach ( $rows as $r ) {
            $facet = (string) ( $r['facet'] ?? '' );
            $type  = (string) ( $r['post_type'] ?? '' );
            $n     = (int) ( $r['n'] ?? 0 );
            if ( $facet === '' || $type === '' ) {
                continue;
            }
            if ( ! isset( $best[ $facet ] ) || $n > $best[ $facet ]['n'] || ( $n === $best[ $facet ]['n'] && $type < $best[ $facet ]['type'] ) ) {
                $best[ $facet ] = [ 'type' => $type, 'n' => $n ];
            }
        }
        return array_map( static fn( array $b ): string => $b['type'], $best );
    }

    /**
     * A full reindex rewrites every facet's rows, so while a background job
     * runs every facet is indexing. Otherwise a facet with rows is indexed,
     * and one without any is waiting for its first index. View facets (ask,
     * pagination, saved bin) never own index rows, so they read as indexed.
     */
    public static function status_for( int $rows, bool $job_running, bool $needs_index = true ): string {
        if ( $job_running ) {
            return self::STATUS_INDEXING;
        }
        return ( $rows > 0 || ! $needs_index ) ? self::STATUS_INDEXED : self::STATUS_PENDING;
    }

    /**
     * Published item count per post type the indexer covers.
     *
     * @return array<int, array{slug: string, label: string, items: int, custom: bool}>
     */
    private function post_types(): array {
        global $wpdb;

        $types = $this->indexer->indexed_post_types();
        if ( $types === [] ) {
            return [];
        }

        $placeholders = implode( ', ', array_fill( 0, count( $types ), '%s' ) );
        $counts       = [];
        $raw          = $wpdb->get_results( $wpdb->prepare(
            "SELECT post_type AS type, COUNT(*) AS n FROM {$wpdb->posts}
             WHERE post_status = 'publish' AND post_type IN ({$placeholders})
             GROUP BY post_type",
            $types
        ), ARRAY_A );
        foreach ( (array) $raw as $r ) {
            $counts[ (string) $r['type'] ] = (int) $r['n'];
        }

        $out = [];
        foreach ( $types as $slug ) {
            $obj = function_exists( 'get_post_type_object' ) ? get_post_type_object( $slug ) : null;
            // The defaults name `product` before WooCommerce exists. An unregistered
            // type has nothing to index or filter, and offering it as a facet's
            // "Applies to" sends the editor to a route that can only 400.
            if ( function_exists( 'get_post_type_object' ) && ! is_object( $obj ) ) {
                continue;
            }
            $label = is_object( $obj ) && isset( $obj->labels->name ) ? (string) $obj->labels->name : $slug;
            $out[] = [
                'slug'   => $slug,
                'label'  => $label,
                'items'  => $counts[ $slug ] ?? 0,
                'custom' => is_object( $obj ) ? empty( $obj->_builtin ) && $slug !== 'product' : false,
            ];
        }
        return $out;
    }
}
