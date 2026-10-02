<?php
/**
 * Pure helpers — no WordPress calls, so tests/lib-test.php runs them bare.
 */

if ( ! function_exists( 'hof_soon_clean_email' ) ) {
	/** Returns a normalised email, or null when it isn't one. */
	function hof_soon_clean_email( string $raw ): ?string {
		$email = strtolower( trim( $raw ) );
		if ( strlen( $email ) > 254 || false === filter_var( $email, FILTER_VALIDATE_EMAIL ) ) {
			return null;
		}
		return $email;
	}
}

if ( ! function_exists( 'hof_soon_is_home_request' ) ) {
	/** True when the request path is the site root, ignoring query string and a sub-directory install. */
	function hof_soon_is_home_request( string $request_uri, string $home_path = '/' ): bool {
		$path = (string) parse_url( $request_uri, PHP_URL_PATH );
		$norm = static fn( string $p ): string => '/' . trim( $p, '/' );
		$home = $norm( $home_path );
		$path = $norm( $path );
		return $path === $home || $path === $home . '/index.php' || ( '/' === $home && '/index.php' === $path );
	}
}

if ( ! function_exists( 'hof_soon_bento_payload' ) ) {
	function hof_soon_bento_payload( string $email, string $tags = '' ): array {
		$subscriber = array( 'email' => $email );
		if ( '' !== trim( $tags ) ) {
			$subscriber['tags'] = trim( $tags );
		}
		return array( 'subscribers' => array( $subscriber ) );
	}
}

if ( ! function_exists( 'hof_soon_queue_add' ) ) {
	/** Appends an email, de-duplicated and capped (oldest dropped). */
	function hof_soon_queue_add( array $queue, string $email, int $cap = 500 ): array {
		if ( ! in_array( $email, $queue, true ) ) {
			$queue[] = $email;
		}
		return array_slice( array_values( $queue ), -$cap );
	}
}
