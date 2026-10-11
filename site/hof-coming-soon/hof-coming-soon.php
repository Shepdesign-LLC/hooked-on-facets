<?php
/**
 * Plugin Name: hooked on facets — coming soon
 * Description: Serves one placeholder homepage with a Bento sign-up form, plus a privacy policy at /privacy/, while the real site is built. Every other front-end URL redirects home. Admins see the normal site. Deactivate to go live.
 * Version:     0.3.0
 * Requires PHP: 8.0
 * License:     GPL-2.0-or-later
 *
 * Credentials: the HOF_SOON_BENTO_* constants in wp-config.php, or, when they
 * are absent, the Bento SDK plugin's saved settings (option bento_settings).
 *
 *   define( 'HOF_SOON_BENTO_SITE_UUID',       '...' );
 *   define( 'HOF_SOON_BENTO_PUBLISHABLE_KEY', '...' );
 *   define( 'HOF_SOON_BENTO_SECRET_KEY',      '...' );
 *   define( 'HOF_SOON_BENTO_TAGS',            'hof-beta' ); // optional, comma separated
 *   define( 'HOF_SOON_PRIVACY_EMAIL',         'privacy@hookedonfacets.com' ); // optional
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
	$page = hof_soon_page_for( $_SERVER['REQUEST_URI'] ?? '/', (string) wp_parse_url( home_url( '/' ), PHP_URL_PATH ) );
	if ( current_user_can( 'manage_options' ) ) {
		// You, building the real site. Still show the policy until a real page claims /privacy/.
		if ( 'privacy' !== $page || ! is_404() ) {
			return;
		}
	}
	if ( null === $page ) {
		wp_safe_redirect( home_url( '/' ), 302 );
		exit;
	}

	nocache_headers();
	header( 'X-Robots-Tag: noindex, follow', true ); // keep Google off the stand-in
	status_header( 200 );
	header( 'Content-Type: text/html; charset=utf-8' );
	echo 'privacy' === $page // phpcs:ignore WordPress.Security.EscapeOutput -- escaped inside the templates
		? hof_soon_render( 'privacy', array( 'contact_email' => hof_soon_privacy_email() ) )
		: hof_soon_render( 'page', array( 'endpoint_url' => rest_url( 'hof-soon/v1/subscribe' ) ) );
	exit;
}

// Hide the core sitemap and feeds from the stand-in too.
add_filter( 'wp_sitemaps_enabled', '__return_false' );

// Point WordPress' own privacy link (login screen, WooCommerce checkout) at the stand-in policy until a real page is set.
add_filter(
	'privacy_policy_url',
	static fn( string $url ): string => '' !== $url ? $url : home_url( '/privacy/' )
);

/** Where privacy requests go. Override with HOF_SOON_PRIVACY_EMAIL in wp-config.php. */
function hof_soon_privacy_email(): string {
	$email = defined( 'HOF_SOON_PRIVACY_EMAIL' ) ? hof_soon_clean_email( (string) HOF_SOON_PRIVACY_EMAIL ) : null;
	return $email ?? 'privacy@hookedonfacets.com';
}

/**
 * Renders templates/{$template}.php. Every template gets $home_url and $privacy_url, plus $vars.
 *
 * @param array<string, mixed> $vars
 */
function hof_soon_render( string $template, array $vars = array() ): string {
	$vars += array(
		'home_url'    => home_url( '/' ),
		'privacy_url' => home_url( '/privacy/' ),
	);
	ob_start();
	( static function ( string $hof_file, array $hof_vars ): void {
		extract( $hof_vars, EXTR_SKIP ); // phpcs:ignore WordPress.PHP.DontExtract
		require $hof_file;
	} )( __DIR__ . '/templates/' . $template . '.php', $vars );
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

/**
 * Bento credentials: wp-config constants, else the Bento SDK plugin's settings.
 *
 * @return array{site_uuid: string, publishable: string, secret: string, source: string}|null
 */
function hof_soon_bento_credentials(): ?array {
	return hof_soon_bento_credentials_from(
		array(
			'site_uuid'   => defined( 'HOF_SOON_BENTO_SITE_UUID' ) ? HOF_SOON_BENTO_SITE_UUID : '',
			'publishable' => defined( 'HOF_SOON_BENTO_PUBLISHABLE_KEY' ) ? HOF_SOON_BENTO_PUBLISHABLE_KEY : '',
			'secret'      => defined( 'HOF_SOON_BENTO_SECRET_KEY' ) ? HOF_SOON_BENTO_SECRET_KEY : '',
		),
		(array) get_option( 'bento_settings', array() )
	);
}

function hof_soon_bento_configured(): bool {
	return null !== hof_soon_bento_credentials();
}

/**
 * One call to Bento's batch import API: POST /api/v1/batch/subscribers, Basic
 * auth with the publishable and secret key, site_uuid in the query string.
 *
 * @return array{ok: bool, code: int, message: string}
 */
function hof_soon_bento_request( string $email, string $first_name = '' ): array {
	$creds = hof_soon_bento_credentials();
	if ( null === $creds ) {
		return array( 'ok' => false, 'code' => 0, 'message' => 'No Bento credentials: set the HOF_SOON_BENTO_* constants in wp-config.php or configure the Bento SDK plugin.' );
	}

	$tags = defined( 'HOF_SOON_BENTO_TAGS' ) ? (string) HOF_SOON_BENTO_TAGS : '';
	$res  = wp_remote_post(
		add_query_arg( 'site_uuid', rawurlencode( $creds['site_uuid'] ), 'https://app.bentonow.com/api/v1/batch/subscribers' ),
		array(
			'timeout' => 8,
			'headers' => array(
				'Authorization' => 'Basic ' . base64_encode( $creds['publishable'] . ':' . $creds['secret'] ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions
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
			printf( '<div class="notice notice-error"><p><strong>hooked on facets — coming soon:</strong> the last sign-up did not reach Bento. %s. Check the three <code>HOF_SOON_BENTO_*</code> keys (or the Bento SDK plugin settings), then run <code>wp hof-soon test you@example.com</code>.</p></div>', esc_html( $error ) );
		}
		if ( ! hof_soon_bento_configured() ) {
			echo '<div class="notice notice-warning"><p><strong>hooked on facets — coming soon:</strong> add the three <code>HOF_SOON_BENTO_*</code> constants to wp-config.php or configure the Bento SDK plugin, or sign-ups are held in a queue.</p></div>';
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
			$creds = hof_soon_bento_credentials();
			if ( null !== $creds ) {
				WP_CLI::log( sprintf( 'Using Bento credentials from %s.', $creds['source'] ) );
			}
			$r = hof_soon_bento_request( $email, 'Test' );
			if ( $r['ok'] ) {
				WP_CLI::success( sprintf( 'Bento accepted %s (HTTP %d). Look for it in your Bento people list.', $email, $r['code'] ) );
			}
			WP_CLI::error( sprintf( 'Bento did not accept it. HTTP %s: %s', $r['code'] ?: 'none', $r['message'] ) );
		}
	);
}
