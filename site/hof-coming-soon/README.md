# hooked on facets — coming soon

A throwaway WordPress plugin for `hookedonfacets.com` while the real site is built.

- `/` shows one bento-style homepage with a beta sign-up form.
- `/privacy/` (or `/privacy-policy/`) shows the privacy policy. Every other inner URL redirects to `/`.
- Logged-in administrators see the normal site, so you can build behind it.
- Deactivate the plugin to go live. Nothing else to undo.
- The page sends `noindex`, so search engines skip the stand-in.

## Setup

If the site already runs the **Bento SDK** plugin with its site key, publishable key and secret key
saved, there is nothing to configure: the plugin reads those settings. To override them, or on a
site without the Bento SDK, add to `wp-config.php`:

```php
define( 'HOF_SOON_BENTO_SITE_UUID',       '...' );
define( 'HOF_SOON_BENTO_PUBLISHABLE_KEY', '...' );
define( 'HOF_SOON_BENTO_SECRET_KEY',      '...' );
define( 'HOF_SOON_BENTO_TAGS',            'hof-beta' ); // optional
```

The form asks for an email and an optional first name. Sign-ups post to
`POST /wp-json/hof-soon/v1/subscribe`, and the server forwards them to Bento's
`/api/v1/batch/subscribers`. If Bento is unreachable or no credentials are found, the sign-up is held in
the `hof_soon_pending` option and retried hourly. The visitor still sees success, and wp-admin shows
what Bento said.

## Privacy policy

`templates/privacy.php` covers the site, the free plugin and Pro. It is linked from the sign-up form
and the footer, and WordPress' own privacy link (login screen, WooCommerce checkout) points to it until
you set a real Privacy Policy page. Admins see it too, unless a real page already answers `/privacy/`.

Privacy requests go to `privacy@hookedonfacets.com`. Make sure that mailbox exists, or override it:

```php
define( 'HOF_SOON_PRIVACY_EMAIL', 'you@example.com' );
```

When what we collect or who we share it with changes, edit the template and bump `$updated` at its top.

## Check it reaches Bento

```bash
wp hof-soon test you@example.com
```

This prints which credentials are in use (wp-config.php or the Bento SDK plugin), sends one test
subscriber and prints Bento's answer. Then look for it in your Bento people list.
A 401 means a wrong key. A 404 usually means a wrong site UUID.

## Test

```bash
php site/hof-coming-soon/tests/lib-test.php
```

Zip the `hof-coming-soon` folder and upload it via Plugins, Add New.
