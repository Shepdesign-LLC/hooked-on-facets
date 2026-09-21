<?php
/**
 * @package HookedOnFacets\Tests\Integrations
 */

declare(strict_types=1);

namespace HookedOnFacets\Tests\Integrations;

use Automattic\WooCommerce\Utilities\FeaturesUtil;
use Brain\Monkey;
use Brain\Monkey\Actions;
use HookedOnFacets\Contracts\Bootable;
use HookedOnFacets\Integrations\WooCommerce;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use PHPUnit\Framework\TestCase;

require_once dirname( __DIR__, 2 ) . '/stubs/FeaturesUtil.php';

final class WooCommerceTest extends TestCase {
    use MockeryPHPUnitIntegration;

    protected function setUp(): void {
        parent::setUp();
        Monkey\setUp();
        FeaturesUtil::reset();
    }

    protected function tearDown(): void {
        FeaturesUtil::reset();
        Monkey\tearDown();
        parent::tearDown();
    }

    // ── boot wiring ───────────────────────────────────────────────────────

    public function test_is_bootable_and_hooks_before_woocommerce_init(): void {
        $wc = new WooCommerce();
        self::assertInstanceOf( Bootable::class, $wc );

        Actions\expectAdded( 'before_woocommerce_init' )
            ->once()
            ->with( [ $wc, 'declare_feature_compatibility' ] );

        $wc->register_hooks();
    }

    // ── feature compatibility ─────────────────────────────────────────────

    public function test_declares_hpos_and_cart_checkout_blocks_as_compatible(): void {
        ( new WooCommerce() )->declare_feature_compatibility();

        $features = array_column( FeaturesUtil::$declared, 'feature' );
        sort( $features );
        self::assertSame( [ 'cart_checkout_blocks', 'custom_order_tables' ], $features );

        foreach ( FeaturesUtil::$declared as $d ) {
            self::assertTrue( $d['positive'], "{$d['feature']} must be declared positively compatible" );
            self::assertSame( HOF_PLUGIN_FILE, $d['file'] );
        }
    }
}
