# Facet Type: Checkbox

The workhorse. Multi-select filtering. The first facet type you'll reach for nine times out of ten.

## what it is

A list of checkbox options. Users tick one or many. Results match items that have *any* (OR) or *all* (AND) of the selected values, depending on configuration.

## when to use it

- Product categories
- Tags
- Product attributes (size, brand, material)
- Multi-value custom meta fields
- Any data where multiple selections are valid

## when not to use it

- More than ~30 options without grouping → use [Dropdown](Facet-Type-Dropdown)
- Single-choice required → use [Radio](Facet-Type-Radio)
- Nested taxonomies → use [Hierarchy](Facet-Type-Hierarchy)
- Visual selections like colors → use [Color Swatch](Facet-Type-Color-Swatch)

## configuration

```json
{
  "name": "category",
  "kind": "taxonomy",
  "source": "product_cat",
  "display": "checkbox",
  "label": "Category",
  "settings": {
    "match": "any"
  }
}
```

### options

| Field | Values | Default | What |
|---|---|---|---|
| `kind` | `"taxonomy"` \| `"meta"` \| `"field"` | — | Where the indexed values come from |
| `source` | string | — | The taxonomy slug or meta/field key (e.g. `product_cat`) |
| `settings.match` | `"any"` \| `"all"` | `"any"` | `any` = OR within the facet (match at least one selected value); `all` = AND (item must carry every selected value) |
| `settings.style` | `"list"` \| `"buttons"` | `"list"` | Render each value as a checkbox row, or as a tappable button. See [button style](#button-style) |
| `settings.button_shape` | `"pill"` \| `"square"` | `"pill"` | Buttons only. Pill uses `--hof-radius-pill`, square uses `--hof-radius-md` |
| `settings.button_fill` | `"outline"` \| `"tinted"` | `"outline"` | Buttons only. Tinted adds a 10% wash of `--hof-primary` behind the label |
| `settings.button_count` | bool | `true` | Buttons only. Show the count on each button |
| `settings.show_empty` | bool | `true` | Buttons only. Keep values with no results, dimmed and not clickable. Off removes them until something matches |

Counts are always rendered next to each option in list style, and refresh based on the *other* active facets (drill-down counts share the resolver's subquery). There are no separate sort / collapse settings in 1.0.0.

## button style

Set `settings.style` to `"buttons"` and each value renders as a button:

```html
<button type="button" class="hof-btn hof-btn--pill hof-btn--outline"
        data-value="alder" aria-pressed="false">
  Alder <span class="hof-btn__count">5</span>
</button>
```

- It's a display option, not a new facet type. Filtering, counts and the URL are identical to list style, so switching style never changes a link.
- Selected values get `aria-pressed="true"`. A value with no results renders with `hof-btn--empty` and `disabled` when `show_empty` is on, and is left out when it's off. A selected value stays clickable so it can be cleared.
- Colors, radius and font come from the `--hof-*` tokens (`--hof-primary`, `--hof-on-primary`, `--hof-surface`, `--hof-radius-pill`, `--hof-radius-md`), so a token change restyles every button facet with no rebuild.
- Every facet's wrapper also carries `hof-facet--<slug>`, so one facet can be restyled on its own: `.hof-facet--brand .hof-btn { text-transform: uppercase; }`.
- Without JavaScript the same crawlable links as list style are emitted (when pretty URLs are on).

## frontend behavior

- Each click toggles the option and triggers a re-query against the index
- The URL updates so the filter state is shareable and survives reload
- Counts refresh based on the *other* active facets (cross-facet awareness)

## URL state

```text
?hof[category]=shirts,pants,shoes
```

Comma-separated term slugs. The `any`/`all` match mode lives in the facet config, not the URL.

## examples

**Multi-select product categories (OR within facet):**

```json
{ "name": "category", "kind": "taxonomy", "source": "product_cat",
  "display": "checkbox", "settings": { "match": "any" } }
```

**All-must-match attribute filter (e.g. "shirts that are *both* organic *and* cotton"):**

```json
{ "name": "features", "kind": "taxonomy", "source": "pa_features",
  "display": "checkbox", "settings": { "match": "all" } }
```

**Meta-sourced checkbox:**

```json
{ "name": "brand", "kind": "meta", "source": "_brand", "display": "checkbox" }
```

## see also

- [Radio](Facet-Type-Radio) — single-select equivalent
- [Hierarchy](Facet-Type-Hierarchy) — for nested taxonomies
- [Dropdown](Facet-Type-Dropdown) — same multi-select, different UI
