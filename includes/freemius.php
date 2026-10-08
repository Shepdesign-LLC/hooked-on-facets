<?php
/**
 * Freemius — opt-in usage insights, the Account and Add-ons screens, and the
 * parent that HOF Pro registers under as an add-on (Pro's licensing and
 * updates run through it).
 *
 * WordPress.org compliant: nothing leaves the site until the owner opts in,
 * and the opt-in can be skipped.
 *
 * Product identity comes from the Freemius dashboard (Settings → Keys).
 * Public values only — the secret key must never be committed. While either
 * value is empty the SDK is not loaded at all: hof_fs() is not defined,
 * `hof_fs_loaded` never fires, and the plugin runs exactly as it did before
 * Freemius. Both can be overridden in wp-config.php, e.g. to point a staging
 * site at a sandbox product.
 *
 * The SDK ships in freemius/ (Freemius' own layout), not through Composer:
 * its package autoloads start.php as a file, which would boot the SDK on
 * every request, configured or not, and in the test bootstrap.
 *
 * @package HookedOnFacets
 */

declare(strict_types=1);

defined( 'ABSPATH' ) || exit;

defined( 'HOF_FS_PRODUCT_ID' ) || define( 'HOF_FS_PRODUCT_ID', '' );
defined( 'HOF_FS_PUBLIC_KEY' ) || define( 'HOF_FS_PUBLIC_KEY', '' );
// The SDK entry point; overridable so tests can stand in a stub.
defined( 'HOF_FS_SDK' ) || define( 'HOF_FS_SDK', HOF_PLUGIN_DIR . 'freemius/start.php' );

/**
 * Whether both Freemius identity values are set.
 */
function hof_fs_is_configured(): bool {
    return (string) HOF_FS_PRODUCT_ID !== '' && (string) HOF_FS_PUBLIC_KEY !== '';
}

/**
 * The fs_dynamic_init() options for the free core plugin.
 *
 * @return array<string, mixed>
 */
function hof_fs_options(): array {
    $page = \HookedOnFacets\Admin\MenuRegistrar::PAGE_SLUG;

    return [
        'id'               => (string) HOF_FS_PRODUCT_ID,
        'slug'             => 'hooked-on-facets',
        'type'             => 'plugin',
        'public_key'       => (string) HOF_FS_PUBLIC_KEY,
        'is_premium'       => false,
        // Core is free; the paid offering is the Pro add-on.
        'has_addons'       => true,
        'has_paid_plans'   => false,
        'is_org_compliant' => true,
        'menu'             => [
            // Freemius' Account and Add-ons pages sit under the plugin's own
            // menu; after the opt-in screen it returns to the app.
            'slug'       => $page,
            'first-path' => 'admin.php?page=' . $page,
            'account'    => true,
            'contact'    => false,
            'support'    => false,
        ],
    ];
}

if ( hof_fs_is_configured() && ! function_exists( 'hof_fs' ) ) {
    /**
     * The core plugin's Freemius instance.
     *
     * @return \Freemius
     */
    function hof_fs() {
        global $hof_fs;

        if ( ! isset( $hof_fs ) ) {
            require_once HOF_FS_SDK;
            $hof_fs = fs_dynamic_init( hof_fs_options() );
        }

        return $hof_fs;
    }

    hof_fs();

    // Freemius registers its own uninstall hook (it reports the uninstall,
    // then fires after_uninstall); a root uninstall.php would replace it.
    hof_fs()->add_action( 'after_uninstall', 'hof_uninstall' );

    // Add-ons (HOF Pro) initialise on this.
    do_action( 'hof_fs_loaded' );
}
