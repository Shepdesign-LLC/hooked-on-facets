<?php
/**
 * SourceCatalog — what a facet can read from, for one post type.
 *
 * Feeds the editor's Source step: taxonomies (with real term counts, whether
 * they nest, whether terms carry swatch colors), fields from the active
 * integrations that actually have data on this post type, and title search.
 * Each entry carries a `shape` the editor uses to decide which facet types fit.
 *
 * @package HookedOnFacets
 */

declare(strict_types=1);

namespace HookedOnFacets\Api;

use HookedOnFacets\Admin\SwatchTermFields;

defined( 'ABSPATH' ) || exit;

final class SourceCatalog {

    public const SHAPE_TAXONOMY = 'taxonomy';
    public const SHAPE_OPTIONS  = 'options';
    public const SHAPE_NUMERIC  = 'numeric';
    public const SHAPE_DATE     = 'date';
    public const SHAPE_BOOLEAN  = 'boolean';
    public const SHAPE_TEXT     = 'text';

    /** Taxonomies that are plumbing, not something a shopper filters by. */
    private const HIDDEN_TAXONOMIES = [ 'post_format', 'product_visibility', 'product_shipping_class', 'product_type' ];

    /**
     * @param array<string, callable(): array<int, array<string, mixed>>> $providers
     *        Integration label => callable returning suggested facet configs.
     *        A provider that isn't active returns [].
     */
    public function __construct( private readonly array $providers = [] ) {}

    /**
     * @return array<int, array<string, mixed>>
     */
    public function for_post_type( string $post_type ): array {
        return array_merge(
            $this->taxonomies( $post_type ),
            $this->fields( $post_type ),
            [ $this->title_search() ]
        );
    }

    /**
     * Facet shape for a suggested display. Pure, so it unit-tests.
     */
    public static function shape_for_display( string $display ): string {
        return match ( $display ) {
            'range'      => self::SHAPE_NUMERIC,
            'date_range' => self::SHAPE_DATE,
            'toggle'     => self::SHAPE_BOOLEAN,
            'search'     => self::SHAPE_TEXT,
            default      => self::SHAPE_OPTIONS,
        };
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function taxonomies( string $post_type ): array {
        global $wpdb;

        $out = [];
        foreach ( (array) get_object_taxonomies( $post_type, 'objects' ) as $slug => $tax ) {
            $slug = (string) $slug;
            if ( in_array( $slug, self::HIDDEN_TAXONOMIES, true ) ) {
                continue;
            }
            if ( empty( $tax->public ) && empty( $tax->show_ui ) ) {
                continue;
            }

            $count  = (int) wp_count_terms( [ 'taxonomy' => $slug, 'hide_empty' => false ] );
            $nested = (int) $wpdb->get_var( $wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->term_taxonomy} WHERE taxonomy = %s AND parent > 0",
                $slug
            ) ) > 0;
            $visual = (int) $wpdb->get_var( $wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->termmeta} tm
                 INNER JOIN {$wpdb->term_taxonomy} tt ON tt.term_id = tm.term_id
                 WHERE tt.taxonomy = %s AND tm.meta_key IN (%s, %s) AND tm.meta_value <> ''",
                $slug,
                SwatchTermFields::META_COLOR,
                SwatchTermFields::META_IMAGE
            ) ) > 0;

            $label = isset( $tax->labels->singular_name ) ? (string) $tax->labels->singular_name : $slug;

            $out[] = [
                'id'           => 'taxonomy:' . $slug,
                'kind'         => 'taxonomy',
                'source'       => $slug,
                'group'        => strncmp( $slug, 'pa_', 3 ) === 0 ? 'attribute' : 'taxonomy',
                'shape'        => self::SHAPE_TAXONOMY,
                'title'        => $label,
                'count'        => $count,
                'empty_terms'  => $this->empty_term_names( $slug ),
                'hierarchical' => ! empty( $tax->hierarchical ),
                'nested'       => $nested,
                'visual'       => $visual,
                'template'     => [
                    'name'     => sanitize_key( strncmp( $slug, 'pa_', 3 ) === 0 ? substr( $slug, 3 ) : $slug ),
                    'label'    => $label,
                    'kind'     => 'taxonomy',
                    'source'   => $slug,
                    'display'  => $nested ? 'hierarchy' : ( $visual ? 'swatch' : 'checkbox' ),
                    'settings' => [],
                ],
            ];
        }
        return $out;
    }

    /**
     * Up to three names of terms nothing is filed under yet.
     *
     * @return string[]
     */
    private function empty_term_names( string $taxonomy ): array {
        $terms = get_terms( [ 'taxonomy' => $taxonomy, 'hide_empty' => false, 'number' => 200 ] );
        if ( ! is_array( $terms ) ) {
            return [];
        }
        $names = [];
        foreach ( $terms as $t ) {
            if ( is_object( $t ) && (int) $t->count === 0 ) {
                $names[] = (string) $t->name;
            }
        }
        return array_slice( $names, 0, 3 );
    }

    /**
     * Fields from the active integrations that have data on this post type.
     *
     * @return array<int, array<string, mixed>>
     */
    private function fields( string $post_type ): array {
        global $wpdb;

        $out  = [];
        $seen = [];
        foreach ( $this->providers as $integration => $provider ) {
            foreach ( (array) $provider() as $cfg ) {
                if ( ! is_array( $cfg ) || ( $cfg['kind'] ?? '' ) !== 'meta' || empty( $cfg['source'] ) ) {
                    continue;
                }
                $source = (string) $cfg['source'];
                if ( isset( $seen[ $source ] ) ) {
                    continue;
                }

                $used = (int) $wpdb->get_var( $wpdb->prepare(
                    "SELECT COUNT(DISTINCT pm.meta_value) FROM {$wpdb->postmeta} pm
                     INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
                     WHERE pm.meta_key = %s AND pm.meta_value <> '' AND p.post_type = %s",
                    $source,
                    $post_type
                ) );
                if ( $used === 0 ) {
                    continue; // Nothing of this post type carries the field.
                }

                $seen[ $source ] = true;
                $shape           = self::shape_for_display( (string) ( $cfg['display'] ?? '' ) );
                $out[]           = [
                    'id'          => 'meta:' . $source,
                    'kind'        => 'meta',
                    'source'      => $source,
                    'group'       => 'field',
                    'integration' => (string) $integration,
                    'shape'       => $shape,
                    'title'       => (string) ( $cfg['label'] ?? $source ),
                    'count'       => $shape === self::SHAPE_OPTIONS ? $used : null,
                    'template'    => [
                        'name'     => (string) ( $cfg['name'] ?? sanitize_key( $source ) ),
                        'label'    => (string) ( $cfg['label'] ?? $source ),
                        'kind'     => 'meta',
                        'source'   => $source,
                        'display'  => (string) ( $cfg['display'] ?? 'checkbox' ),
                        'settings' => is_array( $cfg['settings'] ?? null ) ? $cfg['settings'] : [],
                    ],
                ];
            }
        }
        return $out;
    }

    /**
     * @return array<string, mixed>
     */
    private function title_search(): array {
        return [
            'id'       => 'field:post_title',
            'kind'     => 'field',
            'source'   => 'post_title',
            'group'    => 'text',
            'shape'    => self::SHAPE_TEXT,
            'title'    => 'Title',
            'count'    => null,
            'template' => [
                'name'     => 'search',
                'label'    => 'Search',
                'kind'     => 'field',
                'source'   => 'post_title',
                'display'  => 'search',
                'settings' => [],
            ],
        ];
    }
}
