# Facet Type: Spin the Wheel

A gamified single-select. A cosmetic dial you can spin to land on a random option — built on a real, accessible radiogroup underneath.

## what it is

A spinnable wheel paired with a list of radio options. Tap **Spin** and the dial rotates to a random segment, then commits that option as the selection; or click an option in the list directly. Either way the selection is a single value, exactly like [Radio](Facet-Type-Radio) — the dial is presentation, the radiogroup is the storage.

With JavaScript off, the radiogroup still works as a plain single-select. The conic-gradient dial is `aria-hidden` and purely decorative.

## when to use it

- Playful discovery — "spin to pick a category" on a lifestyle or gift store
- Onboarding a shopper who's happy to be surprised
- A single-select facet where you want a moment of delight, not a dropdown

## when not to use it

- Multiple selections valid → use [Checkbox](Facet-Type-Checkbox)
- A serious, dense single-select → use [Radio](Facet-Type-Radio) or [Dropdown](Facet-Type-Dropdown)
- Long option lists — the dial gets unreadable past ~8 segments → use [Dropdown](Facet-Type-Dropdown)
- Numeric ranges → use [Range Slider](Facet-Type-Range-Slider)

## configuration

The display slug is `spin_the_wheel`.

```json
{
  "name": "mood",
  "kind": "taxonomy",
  "source": "product_cat",
  "display": "spin_the_wheel",
  "label": "Spin for a mood"
}
```

### options

Spin the Wheel exposes **no display-specific settings**. It is single-value by
nature, so the any/all match control does not apply. (Verified against the
`sanitize_settings` allowlist in `src/Api/RestController.php` — `spin_the_wheel`
has no dedicated branch, and the wheel renderer in `src/Facets/Renderer.php`
reads no settings.)

## interaction model

| Input | Action |
|---|---|
| Click **Spin** | Rotates the dial to a random segment, then selects that option |
| Click an option in the list | Selects it directly; the dial syncs to match |
| Click **Clear** | Deselects, clearing the facet from the URL |

The wheel picks a random option, spins forward several full turns so the chosen
segment lands under the top pointer, and on the rotation's `transitionend`
checks the matching radio and fires a `change` event — so the same handler radio
uses picks up the selection and triggers the refetch. A reduced-motion / no-layout
fallback finalizes after a short timeout.

## URL state

```text
?hof[mood]=cozy
```

A single term slug — identical wire format to a radio facet, so the resolver
treats it the same and deep links survive a display-type change.

## theming

The dial colors and size are CSS variables on the facet wrapper:

```css
.hof-facet-wheel {
  --hof-wheel-1: var(--hof-primary);                              /* tone 1 */
  --hof-wheel-2: color-mix(in oklab, var(--hof-primary) 72%, white); /* tone 2 */
  --hof-wheel-3: color-mix(in oklab, var(--hof-primary) 72%, black); /* tone 3 */
  --hof-wheel-4: var(--hof-accent);                               /* tone 4 */
  --hof-wheel-sep: rgba(255, 255, 255, 0.5);  /* hairline between segments */
  --hof-wheel-size: 300px;                    /* dial diameter (260px on phones) */
}
```

The dial has one segment per option, and the four tones repeat around it. A
site that only sets `--hof-primary` still gets a matching wheel. The older
two-tone names still work: `--hof-wheel-a` sets tone 1 and `--hof-wheel-b`
sets tone 4.

## see also

- [Radio](Facet-Type-Radio) — same single-select data shape, plain UI
- [Dropdown](Facet-Type-Dropdown) — single-select for longer lists
- [[Brand Voice|Brand-Voice]] — the brand's voice rules
