# WooCommerce pass

The admin was checked end to end on stock WordPress (no WooCommerce). This pass covers what that
couldn't: WooCommerce sources, prices, swatches, nested categories and the zero-count button. It takes
about ten minutes on a machine that can reach WordPress.org.

Already verified without WooCommerce, so you can skip them: the eight screens render, the Help drawer,
the source-first editor with live preview, saving, tokens restyling the front end, and the Settings
Post types tab.

## 1. Start the stack

```bash
docker compose up -d
docker compose logs -f wp-cli   # wait until it settles; it installs WordPress and WooCommerce
```

Sign in at <http://localhost:8080/wp-admin> with `admin` / `admin`.

## 2. Seed the known catalog

```bash
docker compose exec wp-cli wp eval-file wp-content/plugins/hooked-on-facets/bin/woo-pass-seed.php
docker compose exec wp-cli wp hof reindex
```

You get 12 products and one deliberate empty term:

| Source | Contents |
| --- | --- |
| Brand (`pa_brand`) | Alder 5, Kestrel 4, Orin 3, **Tundra 0** |
| Color (`pa_color`) | Rust, Hook, Moss, each with a swatch color |
| Categories | Outdoor, with Packs and Boots beneath it; Apparel |
| Price | 12 to 140. Two products are out of stock. |

The script is safe to re-run. It creates a page at `/woo-pass/` for the front-end checks.

## 3. Checks

Work through these in wp-admin, under hooked on facets, then Facets, then New facet.

| # | Do this | Expect |
| --- | --- | --- |
| 1 | Applies to: Products. Open the Source list. | Grouped entries: `Attribute: pa_brand (4 values)`, `Attribute: pa_color`, `Taxonomy: product_cat`, `WooCommerce price`, and Title search. Counts come from the data, not hard-coded. |
| 2 | Pick `Attribute: pa_brand (4 values)`. | The explainer rewrites for an attribute and notes that Tundra has no value yet. The preview shows Alder 5, Kestrel 4, Orin 3 and **Tundra 0**. |
| 3 | Look at the Type options with `pa_brand` chosen. | Checkbox, Radio and Dropdown are enabled. Range says `Needs a number`. Fluid swatches says `Needs a color attribute`. |
| 4 | Pick `Attribute: pa_color`. | Fluid swatches becomes enabled. Preview shows the three swatch colors. |
| 5 | Pick `Taxonomy: product_cat`. | Hierarchy is enabled. Preview nests Packs and Boots under Outdoor. |
| 6 | Pick `WooCommerce price`. | Range is enabled and the preview slider spans 12 to 140. Source change resets Type to the first fitting one. |
| 7 | Create a `brand` facet: source `pa_brand`, Type Checkbox, Style **Buttons**, Show values with no results **on**. Save. | A notice says a reindex is needed. |
| 8 | `docker compose exec wp-cli wp hof reindex`, then open `/woo-pass/`. | Brand renders as pills with counts. **Tundra shows dimmed, dashed and disabled.** |
| 9 | Click Alder. | URL gains `hof[brand][0]=alder`. The Alder pill is pressed and results narrow to 5. |
| 10 | Back in the editor, turn Show values with no results **off** and save. Reload `/woo-pass/`. | Tundra is gone. The other three remain. |
| 11 | Design tokens: set Primary to `#D85A30`, Save tokens. Reload `/woo-pass/`. | Pills turn coral with no rebuild. |
| 12 | Facets list. | Brand and price sit under Products with Values counts of 3 and 12 (Tundra has no index rows, so brand counts three) and an Indexed pill. The "Found in your content" strip suggests facets you haven't made yet, such as Color and Category. |
| 13 | Settings, then Post types. | Products is listed, indexed, with 12 items. Turn Posts off and on again. It re-indexes in the background without emptying the index. |

## 4. Report back

For anything that doesn't match, note the check number, what you saw, and a screenshot. Checks 8 and 10
are the two the handoff named as done criteria.

## Reset

```bash
docker compose down -v   # removes the database and WordPress volumes
```
