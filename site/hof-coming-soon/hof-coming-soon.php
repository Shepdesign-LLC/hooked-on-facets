<?php
/**
 * Plugin Name: hooked on facets — coming soon
 * Description: Serves one placeholder homepage with a Bento sign-up form on every front-end URL while the real site is built. Admins see the normal site. Deactivate to go live.
 * Version:     0.1.0
 * Requires PHP: 8.0
 * License:     GPL-2.0-or-later
 *
 * Configure in wp-config.php (secrets stay out of the database):
 *
 *   define( 'HOF_SOON_BENTO_SITE_UUID',       '...' );
 *   define( 'HOF_SOON_BENTO_PUBLISHABLE_KEY', '...' );
 *   define( 'HOF_SOON_BENTO_SECRET_KEY',      '...' );
 *   define( 'HOF_SOON_BENTO_TAGS',            'hof-beta' ); // optional, comma separated
 */

defined( 'ABSPATH' ) || exit;

const HOF_SOON_QUEUE = 'hof_soon_pending';
const HOF_SOON_CRON  = 'hof_soon_retry';

/** Pure helpers live in their own file so they can be tested without WordPress. */
require_once __DIR__ . '/includes/lib.php';

/* ---------------------------------------------------------------- the gate */

add_action( 'template_redirect', 'hof_soon_gate', 0 );

function hof_soon_gate(): void {
	if ( is_admin() || wp_doing_ajax() || wp_doing_cron() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
		return;
	}
	if ( current_user_can( 'manage_options' ) ) {
		return; // you, building the real site
	}
	if ( ! hof_soon_is_home_request( $_SERVER['REQUEST_URI'] ?? '/', (string) wp_parse_url( home_url( '/' ), PHP_URL_PATH ) ) ) {
		wp_safe_redirect( home_url( '/' ), 302 );
		exit;
	}

	nocache_headers();
	header( 'X-Robots-Tag: noindex, follow', true ); // keep Google off the stand-in
	status_header( 200 );
	header( 'Content-Type: text/html; charset=utf-8' );
	echo hof_soon_render_page( rest_url( 'hof-soon/v1/subscribe' ) ); // phpcs:ignore WordPress.Security.EscapeOutput -- escaped inside the template
	exit;
}

// Hide the core sitemap and feeds from the stand-in too.
add_filter( 'wp_sitemaps_enabled', '__return_false' );

function hof_soon_render_page( string $endpoint ): string {
	ob_start();
	$endpoint_url = $endpoint;
	require __DIR__ . '/templates/page.php';
	return (string) ob_get_clean();
}

/* ------------------------------------------------------------ the endpoint */

add_action(
	'rest_api_init',
	static function (): void {
		register_rest_route(
			'hof-soon/v1',
			'/subscribe',
			array(
				'methods'             => 'POST',
				'callback'            => 'hof_soon_subscribe',
				'permission_callback' => '__return_true', // public by design; abuse is handled below
			)
		);
	}
);

function hof_soon_subscribe( WP_REST_Request $request ): WP_REST_Response {
	// Honeypot: real people never fill the hidden field. Pretend success.
	if ( '' !== trim( (string) $request->get_param( 'company' ) ) ) {
		return new WP_REST_Response( array( 'ok' => true ), 200 );
	}

	$email = hof_soon_clean_email( (string) $request->get_param( 'email' ) );
	if ( null === $email ) {
		return new WP_REST_Response( array( 'ok' => false, 'message' => 'That email doesn\'t look right.' ), 422 );
	}

	$ip_key = 'hof_soon_rl_' . md5( (string) ( $_SERVER['REMOTE_ADDR'] ?? '' ) );
	$hits   = (int) get_transient( $ip_key );
	if ( $hits >= 5 ) {
		return new WP_REST_Response( array( 'ok' => false, 'message' => 'Too many tries. Give it a minute.' ), 429 );
	}
	set_transient( $ip_key, $hits + 1, MINUTE_IN_SECONDS * 10 );

	if ( ! hof_soon_send_to_bento( $email ) ) {
		// Never lose a lead: park it and retry from cron.
		hof_soon_enqueue( $email );
	}

	// Same answer either way — the visitor did their part.
	return new WP_REST_Response( array( 'ok' => true ), 200 );
}

/* -------------------------------------------------------------------- Bento */

function hof_soon_bento_configured(): bool {
	return defined( 'HOF_SOON_BENTO_SITE_UUID' ) && defined( 'HOF_SOON_BENTO_PUBLISHABLE_KEY' ) && defined( 'HOF_SOON_BENTO_SECRET_KEY' );
}

/**
 * Bento batch import API: POST /api/v1/batch/subscribers, Basic auth with the
 * publishable and secret key, site_uuid in the query string.
 */
function hof_soon_send_to_bento( string $email ): bool {
	if ( ! hof_soon_bento_configured() ) {
		return false;
	}

	$tags = defined( 'HOF_SOON_BENTO_TAGS' ) ? (string) HOF_SOON_BENTO_TAGS : '';
	$res  = wp_remote_post(
		add_query_arg( 'site_uuid', rawurlencode( HOF_SOON_BENTO_SITE_UUID ), 'https://app.bentonow.com/api/v1/batch/subscribers' ),
		array(
			'timeout' => 8,
			'headers' => array(
				'Authorization' => 'Basic ' . base64_encode( HOF_SOON_BENTO_PUBLISHABLE_KEY . ':' . HOF_SOON_BENTO_SECRET_KEY ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions
				'Content-Type'  => 'application/json',
				'Accept'        => 'application/json',
			),
			'body'    => wp_json_encode( hof_soon_bento_payload( $email, $tags ) ),
		)
	);

	return ! is_wp_error( $res ) && wp_remote_retrieve_response_code( $res ) < 300;
}

/* -------------------------------------------------------------- retry queue */

function hof_soon_enqueue( string $email ): void {
	$queue = (array) get_option( HOF_SOON_QUEUE, array() );
	$queue = hof_soon_queue_add( $queue, $email, 500 );
	update_option( HOF_SOON_QUEUE, $queue, false );
	if ( ! wp_next_scheduled( HOF_SOON_CRON ) ) {
		wp_schedule_event( time() + 300, 'hourly', HOF_SOON_CRON );
	}
}

add_action(
	HOF_SOON_CRON,
	static function (): void {
		$queue = (array) get_option( HOF_SOON_QUEUE, array() );
		$left  = array();
		foreach ( $queue as $email ) {
			if ( ! hof_soon_send_to_bento( (string) $email ) ) {
				$left[] = $email;
			}
		}
		update_option( HOF_SOON_QUEUE, $left, false );
		if ( ! $left ) {
			wp_clear_scheduled_hook( HOF_SOON_CRON );
		}
	}
);

register_deactivation_hook(
	__FILE__,
	static function (): void {
		// Keep the queue (leads!) but stop the retry timer; it restarts on the next failed signup.
		wp_clear_scheduled_hook( HOF_SOON_CRON );
	}
);

/* ------------------------------------------------------------- admin notice */

add_action(
	'admin_notices',
	static function (): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$pending = count( (array) get_option( HOF_SOON_QUEUE, array() ) );
		if ( ! hof_soon_bento_configured() ) {
			echo '<div class="notice notice-warning"><p><strong>hooked on facets — coming soon:</strong> add the three <code>HOF_SOON_BENTO_*</code> constants to wp-config.php, or sign-ups are held in a queue.</p></div>';
		} elseif ( $pending ) {
			printf( '<div class="notice notice-warning"><p><strong>hooked on facets — coming soon:</strong> %d sign-up(s) are waiting to reach Bento and will retry hourly.</p></div>', (int) $pending );
		}
	}
);
