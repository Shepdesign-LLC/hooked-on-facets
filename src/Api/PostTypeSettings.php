<?php
/**
 * PostTypeSettings — which post types the index covers (Settings → Post types).
 *
 * Reads every public post type with its item count and whether indexing is on;
 * saves the admin's choice. Turning one on queues a background index for that
 * type alone (never a full, truncating rebuild); turning one off removes only
 * its rows.
 *
 * @package HookedOnFacets
 */

declare(strict_types=1);

namespace HookedOnFacets\Api;

use HookedOnFacets\Contracts\IndexJobs;
use HookedOnFacets\Indexer;

defined( 'ABSPATH' ) || exit;

final class PostTypeSettings {

    public function __construct( private readonly IndexJobs $jobs ) {}

    /**
     * @return array{
     *   post_types: array<int, array{slug: string, label: string, items: int, indexed: bool, custom: bool, woocommerce: bool}>,
     *   managed_by_filter: bool
     * }
     */
    public function all(): array {
        global $wpdb;

        $registered = self::registered();
        $slugs      = array_keys( $registered );
        $counts     = [];

        if ( $slugs !== [] ) {
            $placeholders = implode( ', ', array_fill( 0, count( $slugs ), '%s' ) );
            $raw          = $wpdb->get_results( $wpdb->prepare(
                "SELECT post_type AS type, COUNT(*) AS n FROM {$wpdb->posts}
                 WHERE post_status = 'publish' AND post_type IN ({$placeholders})
                 GROUP BY post_type",
                $slugs
            ), ARRAY_A );
            foreach ( (array) $raw as $r ) {
                $counts[ (string) $r['type'] ] = (int) $r['n'];
            }
        }

        $indexed = Indexer::configured_post_types();
        $rows    = [];
        foreach ( $registered as $slug => $obj ) {
            $rows[] = [
                'slug'        => $slug,
                'label'       => isset( $obj->labels->name ) ? (string) $obj->labels->name : $slug,
                'items'       => $counts[ $slug ] ?? 0,
                'indexed'     => in_array( $slug, $indexed, true ),
                'custom'      => empty( $obj->_builtin ) && $slug !== 'product',
                'woocommerce' => $slug === 'product',
            ];
        }

        return [
            'post_types'        => self::order( $rows ),
            // A developer filter is changing what the admin chose; say so.
            'managed_by_filter' => $indexed !== Indexer::saved_post_types(),
        ];
    }

    /**
     * Apply the admin's choice.
     *
     * @param array<int, mixed> $requested Post type slugs to index.
     * @return array{status: int, message?: string, queued: string, added: string[], removed: string[]}
     */
    public function save( array $requested ): array {
        $registered = array_keys( self::registered() );
        $before     = Indexer::saved_post_types();
        $after      = self::normalize( $requested, $registered );
        [ $added, $removed ] = self::diff( $before, $after );

        // A second job would fight the first over one progress record, and
        // every chunk of a full job walks by ID, so a type added mid-run would
        // be missed. Ask the admin to wait rather than lose data.
        $running = ! empty( $this->jobs->background_state()['running'] );
        if ( $added !== [] && $running ) {
            return [
                'status'  => 409,
                'message' => 'A rebuild is already running. Try again when it finishes.',
                'queued'  => 'none',
                'added'   => [],
                'removed' => [],
            ];
        }

        update_option( Indexer::OPTION_POST_TYPES, $after, true );

        foreach ( $removed as $type ) {
            $this->jobs->delete_post_type_rows( $type );
        }

        $queued = 'none';
        if ( $added !== [] ) {
            if ( $this->jobs->can_run_background() ) {
                $queued = $this->jobs->queue_reindex_types( $added ) !== null ? 'background' : 'none';
            } else {
                // No scheduler here: the admin runs the rebuild from the Indexer.
                $queued = 'manual';
            }
        }

        return [ 'status' => 200, 'queued' => $queued, 'added' => $added, 'removed' => $removed ];
    }

    /**
     * Requested slugs, cleaned and limited to post types that exist.
     *
     * @param array<int, mixed> $requested
     * @param string[]          $registered
     * @return string[]
     */
    public static function normalize( array $requested, array $registered ): array {
        $clean = [];
        foreach ( $requested as $slug ) {
            if ( is_scalar( $slug ) ) {
                $clean[] = sanitize_key( (string) $slug );
            }
        }
        return array_values( array_intersect( array_unique( $clean ), $registered ) );
    }

    /**
     * @param string[] $before
     * @param string[] $after
     * @return array{0: string[], 1: string[]} [ added, removed ]
     */
    public static function diff( array $before, array $after ): array {
        return [
            array_values( array_diff( $after, $before ) ),
            array_values( array_diff( $before, $after ) ),
        ];
    }

    /**
     * Products first, custom post types A→Z, then the built-ins (posts, pages).
     *
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array<string, mixed>>
     */
    public static function order( array $rows ): array {
        $rank = static fn( array $r ): int => $r['woocommerce'] ? 0 : ( $r['custom'] ? 1 : 2 );
        usort( $rows, static function ( array $a, array $b ) use ( $rank ): int {
            return $rank( $a ) <=> $rank( $b ) ?: strcasecmp( (string) $a['label'], (string) $b['label'] );
        } );
        return $rows;
    }

    /**
     * Public post types that can be indexed. Media isn't a facetable listing.
     *
     * @return array<string, object>
     */
    private static function registered(): array {
        $types = (array) get_post_types( [ 'public' => true ], 'objects' );
        unset( $types['attachment'] );
        return $types;
    }
}
