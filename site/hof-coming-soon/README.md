# hooked on facets — coming soon

A throwaway WordPress plugin for `hookedonfacets.com` while the real site is built.

- Every front-end URL shows one bento-style homepage with a beta sign-up form. Inner URLs redirect to `/`.
- Logged-in administrators see the normal site, so you can build behind it.
- Deactivate the plugin to go live. Nothing else to undo.
- The page sends `noindex`, so search engines skip the stand-in.

## Setup

Add to `wp-config.php`:

```php
define( 'HOF_SOON_BENTO_SITE_UUID',       '...' );
define( 'HOF_SOON_BENTO_PUBLISHABLE_KEY', '...' );
define( 'HOF_SOON_BENTO_SECRET_KEY',      '...' );
define( 'HOF_SOON_BENTO_TAGS',            'hof-beta' ); // optional
```

Sign-ups post to `POST /wp-json/hof-soon/v1/subscribe`, and the server forwards them to Bento's
`/api/v1/batch/subscribers`. If Bento is unreachable or the constants are missing, the email is held in
the `hof_soon_pending` option and retried hourly, and an admin notice shows the count.

## Test

```bash
php site/hof-coming-soon/tests/lib-test.php
```

Zip the `hof-coming-soon` folder and upload it via Plugins, Add New.
