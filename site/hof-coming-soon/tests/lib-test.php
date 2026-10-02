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

$eq( hof_soon_bento_payload( 'a@b.co' ), array( 'subscribers' => array( array( 'email' => 'a@b.co' ) ) ), 'payload bare' );
$eq( hof_soon_bento_payload( 'a@b.co', ' hof-beta ' )['subscribers'][0]['tags'], 'hof-beta', 'payload tags' );

$eq( hof_soon_queue_add( array( 'a@b.co' ), 'a@b.co' ), array( 'a@b.co' ), 'queue dedupes' );
$eq( hof_soon_queue_add( array( 'a', 'b' ), 'c', 2 ), array( 'b', 'c' ), 'queue caps' );

echo $fail ? "$fail failed\n" : "all passed\n";
exit( $fail ? 1 : 0 );
