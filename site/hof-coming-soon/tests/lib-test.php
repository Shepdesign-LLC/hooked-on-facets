<?php
// Run: php site/hof-coming-soon/tests/lib-test.php
require __DIR__ . '/../includes/lib.php';

$fail = 0;
$eq   = static function ( $got, $want, string $name ) use ( &$fail ): void {
	if ( $got !== $want ) {
		++$fail;
		fwrite( STDERR, "FAIL $name: " . var_export( $got, true ) . " !== " . var_export( $want, true ) . "\n" );
	}
};

$eq( hof_soon_clean_email( '  Ryan@ShepDesign.com ' ), 'ryan@shepdesign.com', 'email normalised' );
$eq( hof_soon_clean_email( 'nope' ), null, 'email rejects junk' );
$eq( hof_soon_clean_email( str_repeat( 'a', 250 ) . '@x.io' ), null, 'email rejects overlong' );

$eq( hof_soon_is_home_request( '/' ), true, 'root' );
$eq( hof_soon_is_home_request( '/?utm=1' ), true, 'root + query' );
$eq( hof_soon_is_home_request( '/index.php' ), true, 'index.php' );
$eq( hof_soon_is_home_request( '/pricing/' ), false, 'inner page' );
$eq( hof_soon_is_home_request( '/blog/', '/blog/' ), true, 'subdir root' );
$eq( hof_soon_is_home_request( '/blog/about', '/blog/' ), false, 'subdir inner' );

$eq( hof_soon_page_for( '/' ), 'home', 'route home' );
$eq( hof_soon_page_for( '/privacy/' ), 'privacy', 'route privacy' );
$eq( hof_soon_page_for( '/privacy?ref=x' ), 'privacy', 'route privacy, no slash + query' );
$eq( hof_soon_page_for( '/Privacy-Policy/' ), 'privacy', 'route privacy-policy alias, any case' );
$eq( hof_soon_page_for( '/privacy/extra' ), null, 'route privacy sub-path redirects' );
$eq( hof_soon_page_for( '/pricing/' ), null, 'route inner page redirects' );
$eq( hof_soon_page_for( '/blog/privacy/', '/blog/' ), 'privacy', 'route privacy under subdir' );
$eq( hof_soon_page_for( '/privacy/', '/blog/' ), null, 'route privacy outside subdir redirects' );

$eq( hof_soon_bento_payload( 'a@b.co' ), array( 'subscribers' => array( array( 'email' => 'a@b.co' ) ) ), 'payload bare' );
$eq( hof_soon_bento_payload( 'a@b.co', ' hof-beta ' )['subscribers'][0]['tags'], 'hof-beta', 'payload tags' );

$eq( hof_soon_clean_name( "  Ryan <b>S</b>\n " ), 'Ryan bS/b', 'name drops angle brackets and collapses whitespace' );
$eq( hof_soon_clean_name( str_repeat( 'a', 90 ) ), str_repeat( 'a', 60 ), 'name capped at 60' );
$eq( hof_soon_clean_name( "\x00\x07" ), '', 'name empty when only control chars' );
$eq( hof_soon_bento_payload( 'a@b.co', '', 'Ryan' )['subscribers'][0]['first_name'], 'Ryan', 'payload first_name' );
$eq( isset( hof_soon_bento_payload( 'a@b.co' )['subscribers'][0]['first_name'] ), false, 'payload omits empty first_name' );

$eq( hof_soon_queue_add( array( 'a@b.co' ), 'a@b.co' ), array( 'a@b.co' ), 'queue dedupes' );
$eq( hof_soon_queue_add( array( 'a', 'b' ), 'c', 2 ), array( 'b', 'c' ), 'queue caps' );

$eq( hof_soon_queue_add( array(), 'a@b.co', 500, 'Ryan' ), array( array( 'email' => 'a@b.co', 'first_name' => 'Ryan' ) ), 'queue keeps the name' );
$eq( hof_soon_queue_add( array( array( 'email' => 'a@b.co', 'first_name' => 'R' ) ), 'a@b.co' ), array( array( 'email' => 'a@b.co', 'first_name' => 'R' ) ), 'queue dedupes name entries' );
$eq( hof_soon_queue_entry( 'old@b.co' ), array( 'email' => 'old@b.co', 'first_name' => '' ), 'queue reads old string entries' );

$sdk = array( 'bento_site_key' => ' uuid-1 ', 'bento_publishable_key' => 'pub', 'bento_secret_key' => 'sec' );
$eq( hof_soon_bento_credentials_from( array(), array() ), null, 'creds none' );
$eq( hof_soon_bento_credentials_from( array(), $sdk ), array( 'site_uuid' => 'uuid-1', 'publishable' => 'pub', 'secret' => 'sec', 'source' => 'Bento SDK plugin' ), 'creds fall back to Bento SDK settings, trimmed' );
$eq( hof_soon_bento_credentials_from( array( 'site_uuid' => 'c', 'publishable' => 'cp', 'secret' => 'cs' ), $sdk )['source'], 'wp-config.php', 'creds prefer constants' );
$eq( hof_soon_bento_credentials_from( array( 'site_uuid' => 'c', 'publishable' => '', 'secret' => 'cs' ), $sdk )['source'], 'Bento SDK plugin', 'creds skip incomplete constants' );
$eq( hof_soon_bento_credentials_from( array(), array( 'bento_site_key' => 'x' ) ), null, 'creds reject incomplete SDK settings' );

echo $fail ? "$fail failed\n" : "all passed\n";
exit( $fail ? 1 : 0 );
