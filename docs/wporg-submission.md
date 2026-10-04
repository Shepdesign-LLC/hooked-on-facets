# WordPress.org Submission Guide

How to get Hooked on Facets onto the WordPress.org plugin directory. Internal
runbook.

## Distribution model

WordPress.org hosts **free** plugins only, and this repository **is** the free
plugin. There is no edition switch and nothing to strip:

- **Hooked on Facets (this repo) → WordPress.org.** Ten facet types at full
  resolver speed, the builder, every source and page-builder bridge. It makes
  no external request. It updates through WordPress.org.
- **Hooked on Facets Pro → hookedonfacets.com.** A separate add-on plugin
  (`hooked-on-facets-pro`) with the six signature facets, the AI settings
  screen, the `/ask` and `/visual-dna` routes, and the EDD licensing and
  updater. It never touches WordPress.org.

`bin/build-release.sh` self-verifies that the package carries no `src/Licensing`,
`src/Ai` or `src/VisualDna` directory, so a Pro file can't ship by accident.

## Build the ZIP

From the repo root:

```bash
./bin/build-release.sh
# → dist/hooked-on-facets-<version>.zip
```

The script exports the tracked tree (honoring `.gitattributes` `export-ignore`),
regenerates the `.pot`, installs `--no-dev` Composer deps, builds the Vite
assets, strips dev files and source maps, zips, and self-verifies the package.
It uses Docker when a daemon is running and falls back to the host's own
`composer` and `npm` when it isn't (the committed `.pot` ships as-is when
`wp-cli` is also missing). The `Release` GitHub Action runs the same script.

## Pre-submission checklist

- [ ] **Version is a real release** (no `-alpha` / `-beta`). The plugin header,
      `HOF_VERSION` and `readme.txt` → `Stable tag` all carry the same value.
      WordPress.org serves the Stable tag, and Plugin Check fails on a mismatch.
- [ ] `readme.txt` → `Tested up to` is the current WordPress release, and
      `Contributors` is the **wordpress.org username** that will own the plugin.
- [ ] `readme.txt` → the "Does this plugin contact any external service?" FAQ is
      still true. Keep it current if any outbound call is ever added.
- [ ] Run **Plugin Check** (the `plugin-check` plugin, or `wp plugin check
      hooked-on-facets`) against the built ZIP on a clean install, and clear
      every error. Warnings about direct database queries on the `wp_hof_index`
      table are expected; the index is the product.
- [ ] Plugin runs on a clean WordPress install with no PHP notices.
- [ ] JS source ships (`admin/src/`, `public/src/`) and the repo link is in
      `readme.txt`.
- [ ] Text domain is `hooked-on-facets` throughout; `languages/hooked-on-facets.pot`
      is present.
- [ ] Listing assets exist in `.wordpress-org/` (see below).

## Submit for review

1. Sign in to **wordpress.org** (the username becomes the `Contributors` slug
   and the plugin owner).
2. Go to https://wordpress.org/plugins/developers/add/ and upload the built ZIP.
3. A human reviewer checks it, typically within a few days to a couple of
   weeks. They look for GPL compliance, no self-updating, sanitized and escaped
   I/O, prefixed globals, and an accurate external-services disclosure. Reply
   in the email thread; fixes are re-submitted there.
4. On approval you receive **SVN** access at
   `https://plugins.svn.wordpress.org/hooked-on-facets/` and the listing is
   created.

## Publish via SVN (after approval)

WordPress.org distributes from SVN, not the ZIP. Layout:

```text
hooked-on-facets/
  trunk/            # current version (the plugin files)
  tags/1.2.0/       # a copy of trunk at each release (matches Stable tag)
  assets/           # listing images — NOT shipped in the plugin
```

### Automated (the normal path)

`.github/workflows/wporg-deploy.yml` does the SVN work:

- **On a published GitHub Release** that is not a pre-release, it runs
  `bin/build-release.sh`, unpacks the ZIP, checks that `Stable tag` equals the
  version, and pushes the tree to `trunk/` and `tags/<version>/` with
  [10up/action-wordpress-plugin-deploy](https://github.com/10up/action-wordpress-plugin-deploy).
- **On a push to `main`** that touches `readme.txt` or `.wordpress-org/`, it
  updates the listing's readme and images with
  [10up/action-wordpress-plugin-asset-update](https://github.com/10up/action-wordpress-plugin-asset-update).

Add two repository secrets once SVN access exists: `SVN_USERNAME` and
`SVN_PASSWORD`. Until they exist both jobs no-op with a notice, so the
workflow is safe on `main` today.

So a release is: bump the version in `hooked-on-facets.php` (header +
`HOF_VERSION`) and `readme.txt` (`Stable tag` + changelog), merge to `main`.
The `Release` workflow builds the ZIP and publishes the GitHub release; the
`Deploy to WordPress.org` workflow pushes that same package to SVN.

### Manual (fallback)

```bash
svn co https://plugins.svn.wordpress.org/hooked-on-facets/ svn-hof
# Unzip the build into trunk/ (replace contents), then:
cd svn-hof
svn add --force trunk/*
svn cp trunk tags/1.2.0
svn ci -m "Release 1.2.0"
```

## Listing assets (`.wordpress-org/`)

These drive the directory listing and are never shipped in the plugin. The
deploy workflow uploads them to SVN `assets/`.

| Asset | File | Size | Status |
|---|---|---|---|
| Icon | `icon-256x256.png`, `icon-128x128.png` | 256×256, 128×128 | in repo (brand mark on warm cream) |
| Banner | `banner-1544x500.png`, `banner-772x250.png` | 1544×500, 772×250 | in repo (mark + "Filtering, finally fun.") |
| Screenshots | `screenshot-1.png` … `screenshot-4.png` | any | **todo**: capture from a real install |

The four screenshot captions are already written in `readme.txt` →
`== Screenshots ==` (facet builder, dashboard, front-end facets, tokens editor).
Capture them from the docker stack (`docker compose up -d`, admin/admin) at
1280px wide, PNG, and drop them in `.wordpress-org/` in that order.

## Keeping the editions in sync

The free plugin and the Pro add-on are separate repositories. A Pro release
never involves WordPress.org; a free release never involves the store. The
only coupling is the Pro add-on's minimum core version, which lives in the Pro
repo.
