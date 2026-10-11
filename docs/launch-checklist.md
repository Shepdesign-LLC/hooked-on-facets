# Commercial Launch Checklist

Internal runway for taking Hooked on Facets to a paid product. Status reflects the
`1.0.0` codebase.

## ✅ Done (code side)

- [x] Feature-complete: 16 facet types, INTERSECT resolver, AND/OR matching, cache.
- [x] Performance gates met (~54ms p95 ids / ~63ms full / ~19s reindex on 100k).
- [x] Sources: WooCommerce, ACF, Meta Box, Pods. Builders: Gutenberg, Elementor,
      Bricks, Breakdance, Divi.
- [x] Freemius integration: the free plugin bundles the SDK (WordPress.org
      compliant, opt-in only); Pro is a Freemius add-on for licensing and updates.
- [x] Tests + CI gating (PHP / JS / Markdown). Versions consistent at 1.0.0.
- [x] `readme.txt`, translation template (`languages/hooked-on-facets.pot`), docs.
- [x] Authorship/brand consolidated under Shepdesign, LLC.

## 🟧 Must-do before charging money

- [ ] **Set up Freemius.** The free plugin product, the Pro add-on (parent: the
      free plugin) and Pro's plans.
- [ ] **Set the Freemius IDs and public keys** (`HOF_FS_*`, `HOF_PRO_FS_*`); until
      they are set, neither plugin loads the SDK. See
      [Licensing & Updates](licensing-and-updates.md).
- [ ] **Upload each Pro release ZIP** to the add-on in Freemius.
- [ ] **Build `hookedonfacets.com`** — landing page, feature/benefit sections,
      pricing, checkout, account/license area, docs, support contact.
- [ ] **Tag & publish `v1.0.0`** (GitHub release + store), matching this changelog.

## 🟨 Strongly recommended

- [ ] **Legal:** license EULA/terms, refund policy. Privacy policy ships with the stand-in at
      `hookedonfacets.com/privacy/` (`site/hof-coming-soon/templates/privacy.php`,
      including the AI "ask" facet's Anthropic disclosure); get it a legal read and
      carry it over to the real site.
- [ ] **Support channel:** ticket/email + response expectations.
- [ ] **Build pipeline** for the distributable ZIP: `composer install --no-dev`,
      `npm ci && npm run build`, regenerate the `.pot`, exclude dev files
      (`tests/`, `bin/`, `docker-compose.yml`, `node_modules/`, `.github/`).
- [ ] **Admin-UI translations:** the React admin uses plain React, so its strings
      are not in the PHP `.pot`. If admin translation matters, move admin strings
      onto `@wordpress/i18n` and add a JS string-extraction step.

## 🟦 Known limitations to document (not blockers)

- [ ] Breakdance native placement element (deferred; shortcode placement works).
- [ ] Divi Visual Builder render validation (needs a live Divi install).
- [ ] Pods table / `wp_podsrel` relationship storage (indexer reads postmeta).
- [ ] No time-of-day facet (intentional product decision).

## Website content outline (for hookedonfacets.com)

1. **Hero** — "Sub-50ms faceted filtering for WooCommerce at 100k+ products." CTA.
2. **The problem** — slow meta-query filtering / crawl bloat / clunky builders.
3. **Speed proof** — the benchmark table (`resolve_ids` 54ms, reindex 19s).
4. **Facet showcase** — the standout types (swipe deck, visual DNA, matrix, AI ask).
5. **Builder support** — logos: Gutenberg, Elementor, Bricks, Breakdance, Divi.
6. **Sources** — WooCommerce, ACF, Meta Box, Pods.
7. **Pricing** — tiers (e.g. single-site / 5-site / unlimited; annual).
8. **FAQ** — MySQL 8.0.31 requirement, AI key, GPL, support.
9. **Docs + support links.** Footer: © Shepdesign, LLC, legal links.
