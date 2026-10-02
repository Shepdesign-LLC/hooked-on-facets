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

if ( ! function_exists( 'hof_soon_clean_name' ) ) {
	/** A first name safe to store: no markup or control characters, 60 chars max. Empty when nothing usable is left. */
	function hof_soon_clean_name( string $raw ): string {
		$name = trim( (string) preg_replace( '/[\x00-\x1F\x7F<>]+/u', '', $raw ) );
		$name = (string) preg_replace( '/\s+/u', ' ', $name );
		return function_exists( 'mb_substr' ) ? mb_substr( $name, 0, 60 ) : substr( $name, 0, 60 );
	}
}

if ( ! function_exists( 'hof_soon_bento_payload' ) ) {
	function hof_soon_bento_payload( string $email, string $tags = '', string $first_name = '' ): array {
		$subscriber = array( 'email' => $email );
		if ( '' !== $first_name ) {
			$subscriber['first_name'] = $first_name;
		}
		if ( '' !== trim( $tags ) ) {
			$subscriber['tags'] = trim( $tags );
		}
		return array( 'subscribers' => array( $subscriber ) );
	}
}

if ( ! function_exists( 'hof_soon_queue_entry' ) ) {
	/**
	 * Queue items are plain email strings (v0.1.0) or email + first name arrays.
	 *
	 * @param mixed $item
	 * @return array{email: string, first_name: string}
	 */
	function hof_soon_queue_entry( $item ): array {
		if ( is_array( $item ) ) {
			return array( 'email' => (string) ( $item['email'] ?? '' ), 'first_name' => (string) ( $item['first_name'] ?? '' ) );
		}
		return array( 'email' => (string) $item, 'first_name' => '' );
	}
}

if ( ! function_exists( 'hof_soon_queue_add' ) ) {
	/** Appends a sign-up, de-duplicated by email and capped (oldest dropped). */
	function hof_soon_queue_add( array $queue, string $email, int $cap = 500, string $first_name = '' ): array {
		foreach ( $queue as $item ) {
			if ( hof_soon_queue_entry( $item )['email'] === $email ) {
				return array_slice( array_values( $queue ), -$cap );
			}
		}
		$queue[] = '' === $first_name ? $email : array( 'email' => $email, 'first_name' => $first_name );
		return array_slice( array_values( $queue ), -$cap );
	}
}
