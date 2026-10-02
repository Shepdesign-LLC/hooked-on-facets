<?php
/**
 * Plugin Name: hooked on facets — coming soon
 * Description: Serves one placeholder homepage with a Bento sign-up form on every front-end URL while the real site is built. Admins see the normal site. Deactivate to go live.
 * Version:     0.2.0
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
const HOF_SOON_LAST_ERROR = 'hof_soon_last_error';

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

	$name = hof_soon_clean_name( (string) $request->get_param( 'first_name' ) );
	if ( ! hof_soon_send_to_bento( $email, $name ) ) {
		// Never lose a lead: park it and retry from cron.
		hof_soon_enqueue( $email, $name );
	}

	// Same answer either way — the visitor did their part.
	return new WP_REST_Response( array( 'ok' => true ), 200 );
}

/* -------------------------------------------------------------------- Bento */

function hof_soon_bento_configured(): bool {
	return defined( 'HOF_SOON_BENTO_SITE_UUID' ) && defined( 'HOF_SOON_BENTO_PUBLISHABLE_KEY' ) && defined( 'HOF_SOON_BENTO_SECRET_KEY' );
}

/**
 * One call to Bento's batch import API: POST /api/v1/batch/subscribers, Basic
 * auth with the publishable and secret key, site_uuid in the query string.
 *
 * @return array{ok: bool, code: int, message: string}
 */
function hof_soon_bento_request( string $email, string $first_name = '' ): array {
	if ( ! hof_soon_bento_configured() ) {
		return array( 'ok' => false, 'code' => 0, 'message' => 'The HOF_SOON_BENTO_* constants are not set in wp-config.php.' );
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
			'body'    => wp_json_encode( hof_soon_bento_payload( $email, $tags, $first_name ) ),
		)
	);

	if ( is_wp_error( $res ) ) {
		return array( 'ok' => false, 'code' => 0, 'message' => $res->get_error_message() );
	}
	$code = (int) wp_remote_retrieve_response_code( $res );
	return array(
		'ok'      => $code >= 200 && $code < 300,
		'code'    => $code,
		'message' => substr( wp_strip_all_tags( (string) wp_remote_retrieve_body( $res ) ), 0, 200 ),
	);
}

/** Sends one subscriber. A failure is logged and kept for the admin notice, never shown to the visitor. */
function hof_soon_send_to_bento( string $email, string $first_name = '' ): bool {
	$r = hof_soon_bento_request( $email, $first_name );
	if ( $r['ok'] ) {
		delete_option( HOF_SOON_LAST_ERROR );
		return true;
	}
	$line = sprintf( 'Bento said %s: %s', $r['code'] ?: 'no response', $r['message'] );
	error_log( '[hof-coming-soon] ' . $line ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
	update_option( HOF_SOON_LAST_ERROR, $line, false );
	return false;
}

/* -------------------------------------------------------------- retry queue */

function hof_soon_enqueue( string $email, string $first_name = '' ): void {
	$queue = (array) get_option( HOF_SOON_QUEUE, array() );
	$queue = hof_soon_queue_add( $queue, $email, 500, $first_name );
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
		foreach ( $queue as $item ) {
			$entry = hof_soon_queue_entry( $item );
			if ( ! hof_soon_send_to_bento( $entry['email'], $entry['first_name'] ) ) {
				$left[] = $item;
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
		$error   = (string) get_option( HOF_SOON_LAST_ERROR, '' );
		if ( '' !== $error ) {
			printf( '<div class="notice notice-error"><p><strong>hooked on facets — coming soon:</strong> the last sign-up did not reach Bento. %s. Check the three <code>HOF_SOON_BENTO_*</code> keys, then run <code>wp hof-soon test you@example.com</code>.</p></div>', esc_html( $error ) );
		}
		if ( ! hof_soon_bento_configured() ) {
			echo '<div class="notice notice-warning"><p><strong>hooked on facets — coming soon:</strong> add the three <code>HOF_SOON_BENTO_*</code> constants to wp-config.php, or sign-ups are held in a queue.</p></div>';
		} elseif ( $pending ) {
			printf( '<div class="notice notice-warning"><p><strong>hooked on facets — coming soon:</strong> %d sign-up(s) are waiting to reach Bento and will retry hourly.</p></div>', (int) $pending );
		}
	}
);

/* ------------------------------------------------------------------- WP-CLI */

if ( defined( 'WP_CLI' ) && WP_CLI ) {
	/**
	 * Sends one test subscriber to Bento and prints exactly what came back.
	 *
	 * ## EXAMPLES
	 *
	 *     wp hof-soon test you@example.com
	 *
	 * @param array<int, string> $args Positional args: the email to subscribe.
	 */
	WP_CLI::add_command(
		'hof-soon test',
		static function ( array $args ): void {
			$email = hof_soon_clean_email( (string) ( $args[0] ?? '' ) );
			if ( null === $email ) {
				WP_CLI::error( 'Give a valid email: wp hof-soon test you@example.com' );
			}
			$r = hof_soon_bento_request( $email, 'Test' );
			if ( $r['ok'] ) {
				WP_CLI::success( sprintf( 'Bento accepted %s (HTTP %d). Look for it in your Bento people list.', $email, $r['code'] ) );
			}
			WP_CLI::error( sprintf( 'Bento did not accept it. HTTP %s: %s', $r['code'] ?: 'none', $r['message'] ) );
		}
	);
}
