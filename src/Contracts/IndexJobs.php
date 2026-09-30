<?php
/**
 * The slice of the indexer that switching a post type on or off needs.
 *
 * @package HookedOnFacets
 */

declare(strict_types=1);

namespace HookedOnFacets\Contracts;

defined( 'ABSPATH' ) || exit;

interface IndexJobs {

    /**
     * Whether a chunked background job can run here.
     */
    public function can_run_background(): bool;

    /**
     * Queue a background index for only these post types, without truncating.
     * Null when another job is already running.
     *
     * @param string[] $types
     * @return array<string, mixed>|null
     */
    public function queue_reindex_types( array $types, int $chunk_size = 200 ): ?array;

    /**
     * Drop the index rows for one post type.
     */
    public function delete_post_type_rows( string $post_type ): void;

    /**
     * Progress record of the current or last background job.
     *
     * @return array<string, mixed>
     */
    public function background_state(): array;
}
