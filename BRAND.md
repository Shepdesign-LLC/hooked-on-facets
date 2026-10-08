# Hooked on Facets — Brand Identity

> The complete brand system for the Hooked on Facets WordPress plugin.
> Reference this file when generating any UI, marketing site, plugin admin screens, or visual content.
> Last updated: October 2026 · v1.1.0

---

## Name & Voice

- **Brand name:** Hooked on Facets
- **Wordmark:** Always lowercase as wordmark — `hooked on facets`
- **Shorthand:** HOF (uppercase, used in dev/internal contexts only — never as a public-facing brand name)

### Taglines

| Line | Use |
|------|-----|
| **Filtering, finally fun.** | Primary tagline. Homepage hero. Always paired with logo. |
| **Beyond the checkbox.** | Campaign / advertising line. Twitter bios, banner ads. |
| **Hook in. Stand out.** | Developer-audience line. Docs landing, GitHub README. |

### Voice Rules

- **Sentence case everywhere.** No title case headlines. No ALL CAPS in source.
- Where labels need to read as caps (eyebrows, monospace tags), use CSS `text-transform: uppercase` so screen readers and search read it natural.
- **Confident, never cocky.** The features do the bragging. Copy stays calm.
- **Honest about competitors.** Use specific words — "shortcodes", "basic", "partial" — not vague swipes.
- **Numbers are loud.** Always include real numbers (42ms, 24,718 products, 7 of 12 facets).
- **No corporate hedging.** Never write "we believe" or "we think." State things plainly.

---

## Logo Mark

Three-plane isometric faceted hexagon with a coral spark at the apex. Reads as a gem, a node, and a wireframe object simultaneously.

Standalone files in this repo:

- `brand/logo.svg` — full lockup (mark + wordmark)
- `brand/logo-mark.svg` — mark only (favicon, sidebar, small contexts)

### Inline SVG (single source of truth)

```svg
<svg width="72" height="72" viewBox="0 0 72 72" role="img" aria-label="Hooked on Facets">
  <title>Hooked on Facets</title>
  <desc>Faceted hexagon in purple with a coral spark.</desc>
  <path d="M36 6 L62 21 L36 36 L10 21 Z" fill="#7F77DD"/>
  <path d="M10 21 L10 51 L36 66 L36 36 Z" fill="#3C3489"/>
  <path d="M62 21 L62 51 L36 66 L36 36 Z" fill="#534AB7"/>
  <circle cx="36" cy="6" r="3.5" fill="#D85A30"/>
</svg>
```

### Mark Rules

- Minimum size: **14px** (works because the geometry is simple)
- Always paired with wordmark in marketing contexts
- Standalone use OK at small sizes (favicon, admin sidebar, app tile)
- **Never recolor.** It's two purples and one coral. That's it.
- **Never add a stroke.** It's a filled solid shape.
- **Never put it inside another shape** (no circles, no rounded squares behind it).
- **Never animate the facets independently.** If the logo moves, it rotates as one rigid object.

---

## Color Palette

### Primary palette

| Role | Name | Hex | Use |
|------|------|-----|-----|
| Brand primary | Hook purple | `#534AB7` | Primary actions, system states, brand surfaces |
| Brand accent | Facet coral | `#D85A30` | Energy moments — deploy buttons, eyebrow labels, "wins" |
| Foreground | Deep ink | `#2C2C2A` | Body text, headings, dark surfaces |
| Background | Warm cream | `#F1EFE8` | Light marketing surfaces |

### Supporting purple ramp

| Token | Hex | Use |
|-------|-----|-----|
| purple-50 | `#EEEDFE` | Tinted backgrounds, "selected column" highlights |
| purple-200 | `#CECBF6` | Soft accents, borders on purple surfaces |
| purple-400 | `#7F77DD` | Logo top facet, mid-emphasis text on dark |
| purple-700 | `#3C3489` | Logo left facet, deepest brand tone |

### Supporting coral ramp

| Token | Hex | Use |
|-------|-----|-----|
| coral-50 | `#FAECE7` | Coral text on coral surfaces |
| coral-200 | `#F5C4B3` | Coral-on-coral metadata |

### Neutrals (warm gray, not pure gray)

| Token | Hex | Use |
|-------|-----|-----|
| ink-900 | `#1A1A19` | Top bars on admin screens, darkest surfaces |
| ink-700 | `#5F5E5A` | Secondary text |
| ink-500 | `#888780` | Tertiary text, muted labels |
| ink-300 | `#B4B2A9` | Disabled, faint indicators |
| ink-200 | `#D3D1C7` | Borders, dividers |
| ink-100 | `#E6E3D9` | Canvas/sandbox backgrounds |
| ink-50 | `#F8F6EE` | Group header stripes |

### Why this palette wins

- **Purple in a sea of blue.** Every competitor (FacetWP, WP Grid Builder, Search & Filter Pro) is blue or teal. We are not.
- **Coral is energy.** Filter plugins are boring. Coral signals play, motion, fun.
- **Warm neutrals.** Pure white and pure gray feel like a settings panel. Cream and warm ink feel like a product.

---

## Typography

### Fonts

- **Display + Body:** Geist Sans (Vercel, free, loaded from Google Fonts)
- **Mono:** Geist Mono (labels, code, eyebrows)

### Google Fonts include

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### Type Scale

| Role | Size | Weight | Letter-spacing | Use |
|------|------|--------|----------------|-----|
| Display XL | 44px | 500 | -0.03em | Hero headline |
| Display L | 30px | 500 | -0.02em | Comparison page headline |
| Heading | 22px | 500 | -0.02em | Admin hero card title |
| Subhead | 20px | 500 | -0.02em | Section titles |
| Body | 15px | 400 | normal | Body copy |
| Body small | 13px | 400 | normal | Card metadata |
| Label | 11–12px | 500 | normal | Buttons, pills |
| Eyebrow | 10–11px | 500 | 0.12–0.14em | Coral monospace labels, ALWAYS uppercase via CSS |
| Mono code | 13–14px | 400 | normal | Inline code, file paths |

### Typography rules

- Headlines are sentence case. Always.
- Eyebrow labels: written in sentence case in source; uppercase applied via `text-transform: uppercase`.
- Numbers in stats and metadata are tabular: `font-variant-numeric: tabular-nums`.
- Line-height: 1.1–1.2 for headlines, 1.5–1.6 for body.

---

## Layout & Surfaces

### Border radii

| Token | Value | Use |
|-------|-------|-----|
| Small | 6–8px | Inputs, buttons, segmented control items |
| Medium | 12px | Cards, panels |
| Large | 16px | Frames, hero cards |
| Pill | 999px | Badges, tags, monospace pills |

### Borders

- **1px.** Never thicker. 0.5px strokes blur or vanish on standard (1x)
  displays, so they read as broken, not refined.
- Default border color: `#D3D1C7` (ink-200)
- Subtle divider color: `#E6E3D9` (ink-100)

### Soft elevation, no gradients

Depth comes from color tone contrast first, then a soft lift. Shadows are
allowed only from the elevation scale below: warm-ink based, low opacity,
never colored, never decorative.

| Token | Value | Use |
|-------|-------|-----|
| `--hof-shadow-xs` | `0 1px 2px rgb(28 27 25 / 0.06)` | Buttons, inputs, the selected segment, the active nav item |
| `--hof-shadow-sm` | `0 1px 2px rgb(28 27 25 / 0.04), 0 2px 8px rgb(28 27 25 / 0.04)` | Cards, panels, tables |
| `--hof-shadow-lg` | `0 12px 40px rgb(28 27 25 / 0.12), 0 2px 6px rgb(28 27 25 / 0.05)` | Drawers, tooltips, the top card of a stack |

No gradients. The one exception is functional: a scrim that keeps text legible
over a photo.

### Spacing

Use multiples of 4px: 4, 8, 12, 16, 20, 24, 32, 40, 48.

---

## Iconography

- **Tabler Icons (outline)** as the icon set
- Webfont CDN: `https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css`
- React: `npm install @tabler/icons-react`
- Sizes: 13–16px in body, 18–22px in hero/featured contexts
- Color: inherits text color by default; primary actions get purple, energy moments get coral

**No filled icons, no Material, no Heroicons, no Lucide.** Tabler outline is the family.

---

## Brand-In-Use Patterns

### The "Live" indicator

- 7px coral circle (`#D85A30`) next to a monospace uppercase label
- Used for active states: "AUTO-HOOK ENGINE · LIVE", "EDITING", facet status dots

### The "Editing" badge

- Floats top-right of selected items, slight overhang (`top: -9px`)
- Coral background, cream text, 9–10px monospace, letter-spacing 0.1em
- Rounded pill (`border-radius: 999px`)

### The builder badge row

- Always lists: Bricks, Elementor, Breakdance, Oxygen, Gutenberg, WooCommerce
- Small cream pills with 1px gray border
- Preceded by monospace label: `AUTO-HOOKS:`

### The comparison table

- HOF column always has tinted purple background (`#EEEDFE`)
- HOF wins are 22px coral filled circles with cream check icons inside
- Competitor partial wins are italic gray text ("shortcodes", "basic", "partial")
- Missing features are gray em-dashes (`—`)

### The monospace eyebrow

- Coral text (`#D85A30`), Geist Mono, ~10–11px
- `letter-spacing: 0.12em–0.14em`
- `text-transform: uppercase` via CSS
- Used above every headline to signal section type

---

## File Conventions

| Path | Contains |
|------|----------|
| `BRAND.md` | This file. Always at project root. |
| `brand/logo.svg` | Full lockup (mark + wordmark) |
| `brand/logo-mark.svg` | Mark only |
| `brand/colors.css` | CSS variables for every color token |
| `brand/typography.css` | Type styles + Google Fonts include |
| `marketing/preview/*.html` | Static brand-in-use previews |

---

## Don'ts

- ❌ Never use blue. The competitors are blue. We are purple.
- ❌ Never use borders thicker than 1px, or sub-pixel (0.5px) hairlines.
- ❌ Never use hard, dark, colored or decorative shadows. Only the soft elevation tokens.
- ❌ Never use gradients (functional photo scrims aside).
- ❌ Never use ALL CAPS in source — use sentence case + `text-transform: uppercase`.
- ❌ Never use generic "Lorem ipsum." Use real-feeling product copy.
- ❌ Never use stock icons or detailed illustrations. Tabler outline icons only.
- ❌ Never recolor the logo. It's two purples and a coral.
- ❌ Never use filled icons or rounded-square containers around the logo.
- ❌ Never write "click here" — write the destination.

---

## Naming Conventions for Code

- CSS variables: `--hof-color-*`, `--hof-font-*`, `--hof-radius-*`
- WordPress hooks: `hof_*` (filters) and `do_action('hof_*', ...)`
- PHP namespace: `HookedOnFacets\`
- JS/TS classes: `Hof*` (e.g., `HofFacetEngine`, `HofIndexer`)
- Data attributes: `data-hof-*` (e.g., `data-hof-facet="color"`)
