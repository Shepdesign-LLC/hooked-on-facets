# Licensing & Updates

Hooked on Facets is GPL-2.0-or-later. Licensing, checkout and updates for the
paid **Hooked on Facets Pro** add-on run on [Freemius](https://freemius.com).

## How it fits together

- **Hooked on Facets (free, WordPress.org)** bundles the Freemius SDK in
  WordPress.org-compliant mode. On activation it asks whether to share
  non-sensitive diagnostic data; nothing is sent unless the site owner opts in,
  and the opt-in can be skipped. Freemius adds **Account** and **Add-Ons**
  screens under the plugin's menu. Free updates come from WordPress.org.
- **Hooked on Facets Pro (paid add-on)** registers with Freemius as an add-on of
  the free plugin. Freemius handles license activation, renewals, seat moves and
  Pro's automatic updates.

## For site owners

1. Buy Pro from the **Add-Ons** screen (or the website) and install the ZIP from
   your purchase email.
2. Activate your license from **Hooked on Facets → Account**, or the
   *Activate License* link on the Plugins screen.
3. Pro updates then appear on the WordPress Updates screen like any other plugin.

**Hooked on Facets → License** shows the license status with links to activate,
renew or manage it. An unlicensed or expired Pro keeps working; it just stops
receiving updates.

## Configuration

Each plugin reads its Freemius identity from two constants. They default to
empty, and while either is empty that plugin doesn't load the SDK at all. Set
them in the code before release, or in `wp-config.php` to point a staging site
at a sandbox product:

| Constant | Plugin | Value |
|---|---|---|
| `HOF_FS_PRODUCT_ID` | free | Freemius product ID |
| `HOF_FS_PUBLIC_KEY` | free | Freemius public key (`pk_…`) |
| `HOF_PRO_FS_PRODUCT_ID` | Pro | Freemius add-on ID |
| `HOF_PRO_FS_PUBLIC_KEY` | Pro | Freemius add-on public key (`pk_…`) |

Public values only. **Never commit or ship a Freemius secret key.**

## For the store operator (Shepdesign, LLC)

1. In Freemius, create the **Hooked on Facets** plugin product and the **Hooked on
   Facets Pro** add-on (with the free plugin as its parent), plus Pro's plans.
2. Set the four constants above to the dashboard values.
3. Release the free plugin to WordPress.org as usual (`bin/build-release.sh`).
4. Upload each Pro release ZIP to the add-on in Freemius; Freemius serves it to
   licensed sites.

## Notes

- The SDK lives in `freemius/` in the free plugin (Freemius' own layout), not in
  `vendor/`: its Composer package autoloads `start.php`, which would boot the SDK
  on every request. Pro uses the free plugin's copy.
- There is no root `uninstall.php`: it would stop Freemius' uninstall hook from
  running. Data cleanup is `hof_uninstall()`, run on Freemius' `after_uninstall`.

See the [Launch Checklist](launch-checklist.md) for the full runway.
