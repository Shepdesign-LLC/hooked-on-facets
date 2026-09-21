<?php
/**
 * Recording stub for WooCommerce's FeaturesUtil so compatibility declarations
 * can be asserted without a live WooCommerce install. Only the static
 * declare_compatibility() entry point is modelled — that's all HOF calls.
 *
 * @package HookedOnFacets\Tests
 */

declare(strict_types=1);

namespace Automattic\WooCommerce\Utilities;

if ( ! class_exists( FeaturesUtil::class ) ) {
	final class FeaturesUtil {
		/** @var array<int, array{feature: string, file: string, positive: bool}> */
		public static array $declared = [];

		public static function declare_compatibility( string $feature_id, string $plugin_file, bool $positive_compatibility = true ): bool {
			self::$declared[] = [
				'feature'  => $feature_id,
				'file'     => $plugin_file,
				'positive' => $positive_compatibility,
			];
			return true;
		}

		public static function reset(): void {
			self::$declared = [];
		}
	}
}
