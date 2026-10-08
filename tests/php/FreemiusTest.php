<?php
/**
 * @package HookedOnFacets\Tests
 */

declare(strict_types=1);

namespace HookedOnFacets\Tests;

use Brain\Monkey;
use Brain\Monkey\Functions;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunInSeparateProcess;
use PHPUnit\Framework\TestCase;

/**
 * Freemius bootstrap and the uninstall path it now owns.
 *
 * The test run never sets HOF_FS_PRODUCT_ID / HOF_FS_PUBLIC_KEY, so these
 * cover the unconfigured plugin plus the options the SDK would be given.
 */
final class FreemiusTest extends TestCase {

    private const ROOT = __DIR__ . '/../..';

    /** Load the unconfigured bootstrap (the configured test loads its own). */
    private static function boot(): void {
        require_once self::ROOT . '/includes/uninstall.php';
        require_once self::ROOT . '/includes/freemius.php';
    }

    protected function setUp(): void {
        parent::setUp();
        Monkey\setUp();
    }

    protected function tearDown(): void {
        Monkey\tearDown();
        parent::tearDown();
    }

    // ── bootstrap ────────────────────────────────────────────────────────

    public function test_without_product_id_and_key_the_sdk_is_not_loaded(): void {
        self::boot();
        self::assertFalse( hof_fs_is_configured() );
        self::assertFalse( function_exists( 'hof_fs' ), 'hof_fs() exists only once Freemius is configured' );
        self::assertFalse( function_exists( 'fs_dynamic_init' ), 'freemius/start.php must not load unconfigured' );
    }

    public function test_core_is_a_free_wordpress_org_compliant_parent_of_add_ons(): void {
        self::boot();
        $o = hof_fs_options();

        self::assertSame( 'hooked-on-facets', $o['slug'] );
        self::assertSame( 'plugin', $o['type'] );
        self::assertFalse( $o['is_premium'] );
        self::assertFalse( $o['has_paid_plans'], 'core is free; Pro is the paid add-on' );
        self::assertTrue( $o['has_addons'] );
        self::assertTrue( $o['is_org_compliant'], 'nothing may leave the site before opt-in' );
        self::assertArrayNotHasKey( 'secret_key', $o, 'the secret key must never ship' );
    }

    public function test_freemius_pages_sit_under_the_plugin_menu_and_return_to_the_app(): void {
        self::boot();
        $menu = hof_fs_options()['menu'];

        self::assertSame( 'hooked-on-facets', $menu['slug'] );
        self::assertSame( 'admin.php?page=hooked-on-facets', $menu['first-path'] );
        self::assertTrue( $menu['account'] );
    }

    public function test_the_sdk_ships_in_the_freemius_folder(): void {
        self::assertFileExists( self::ROOT . '/freemius/start.php' );
    }

    public function test_there_is_no_root_uninstall_php_to_shadow_the_freemius_hook(): void {
        self::assertFileDoesNotExist( self::ROOT . '/uninstall.php' );
    }

    /**
     * The configured path, against a stub SDK: hof_fs() boots it once with
     * core's options, hooks hof_uninstall to after_uninstall, and fires
     * hof_fs_loaded for add-ons.
     */
    #[RunInSeparateProcess]
    #[PreserveGlobalState( false )]
    public function test_configured_freemius_boots_once_and_signals_add_ons(): void {
        $stub = sys_get_temp_dir() . '/hof-fs-stub-' . getmypid() . '/';
        @mkdir( $stub . 'freemius', 0777, true );
        file_put_contents( $stub . 'freemius/start.php', <<<'PHP'
<?php
function fs_dynamic_init( array $options ) {
    $GLOBALS['hof_fs_stub_inits'][] = $options;
    return new class() {
        public array $actions = [];
        public function add_action( string $tag, $cb ): void { $this->actions[ $tag ] = $cb; }
    };
}
PHP );

        define( 'HOF_FS_PRODUCT_ID', '12345' );
        define( 'HOF_FS_PUBLIC_KEY', 'pk_test' );
        define( 'HOF_FS_SDK', $stub . 'freemius/start.php' );
        $fired = 0;
        Functions\when( 'do_action' )->alias( static function ( $tag ) use ( &$fired ): void {
            if ( $tag === 'hof_fs_loaded' ) $fired++;
        } );

        require self::ROOT . '/includes/uninstall.php';
        require self::ROOT . '/includes/freemius.php';

        self::assertTrue( hof_fs_is_configured() );
        self::assertSame( hof_fs(), hof_fs(), 'one instance' );
        self::assertCount( 1, $GLOBALS['hof_fs_stub_inits'] );
        self::assertSame( '12345', $GLOBALS['hof_fs_stub_inits'][0]['id'] );
        self::assertSame( 'pk_test', $GLOBALS['hof_fs_stub_inits'][0]['public_key'] );
        self::assertSame( 'hof_uninstall', hof_fs()->actions['after_uninstall'] ?? null );
        self::assertSame( 1, $fired, 'hof_fs_loaded fires once' );
    }

    // ── uninstall ────────────────────────────────────────────────────────

    public function test_uninstall_keeps_data_unless_the_site_opted_in(): void {
        self::boot();
        Functions\when( 'is_multisite' )->justReturn( false );
        Functions\when( 'get_option' )->justReturn( false );
        Functions\expect( 'delete_option' )->never();

        $GLOBALS['wpdb'] = new class() {
            public string $prefix = 'wp_';
            public function query( string $sql ): void {
                throw new \LogicException( 'no table may be dropped without opt-in' );
            }
        };

        hof_uninstall();

        self::assertTrue( true );
        unset( $GLOBALS['wpdb'] );
    }

    public function test_uninstall_cleans_each_site_that_opted_in(): void {
        self::boot();
        $opted_in = [ 1 => true, 2 => false ];
        $current  = 0;
        $dropped  = [];

        Functions\when( 'is_multisite' )->justReturn( true );
        Functions\when( 'get_sites' )->justReturn( [ 1, 2 ] );
        Functions\when( 'switch_to_blog' )->alias( static function ( int $id ) use ( &$current ): void { $current = $id; } );
        Functions\when( 'restore_current_blog' )->justReturn( true );
        Functions\when( 'get_option' )->alias( static function ( $name ) use ( &$current, $opted_in ): bool {
            return $name === 'hof_uninstall_remove_data' && $opted_in[ $current ];
        } );
        Functions\when( 'delete_option' )->justReturn( true );
        Functions\when( 'delete_transient' )->justReturn( true );
        Functions\when( 'wp_clear_scheduled_hook' )->justReturn( 0 );

        $GLOBALS['wpdb'] = new class( $current, $dropped ) {
            public string $prefix = 'wp_';
            public function __construct( private int &$site, private array &$log ) {}
            public function query( string $sql ): void { $this->log[] = $this->site; }
        };

        hof_uninstall();

        self::assertSame( [ 1 ], $dropped, 'only the site that opted in loses its index table' );
        unset( $GLOBALS['wpdb'] );
    }
}
