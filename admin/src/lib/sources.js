// What a facet can read from, and which facet types fit each source.
// The catalog itself comes from GET /sources; everything here is pure so the
// rules live in one place and unit-test without a browser.

const nf = new Intl.NumberFormat('en-US');

export const SOURCE_GROUPS = [
    { key: 'attribute', label: 'Attributes' },
    { key: 'taxonomy',  label: 'Taxonomies' },
    { key: 'field',     label: 'Fields' },
    { key: 'text',      label: 'Text search' },
];

// Displays that don't read a source: they drive other facets, page results,
// or filter by a saved set of items.
export const VIEW_TYPES = new Set(['ask', 'visual_dna', 'pagination', 'saved_bin']);

// Type picker. `pro` marks the signature displays shipped by the Pro add-on.
// `needs` is the reason shown when the current source doesn't fit; `hint` is
// the subtitle when it does. Order is the picker order.
export const TYPES = [
    { value: 'checkbox',       label: 'Checkbox',            hint: 'Pick several',            needs: 'Needs a list of values' },
    { value: 'radio',          label: 'Radio',               hint: 'Pick one',                needs: 'Needs a list of values' },
    { value: 'dropdown',       label: 'Dropdown',            hint: 'Compact, pick one',       needs: 'Needs a list of values' },
    { value: 'toggle',         label: 'Toggle',              hint: 'On or off',               needs: 'Needs a yes/no field' },
    { value: 'range',          label: 'Range',               hint: 'Slider with min and max', needs: 'Needs a number' },
    { value: 'search',         label: 'Search',              hint: 'Results as you type',     needs: 'Needs text' },
    { value: 'date_range',     label: 'Date range',          hint: 'Between two dates',       needs: 'Needs a date' },
    { value: 'hierarchy',      label: 'Hierarchy',           hint: 'Nested, expandable',      needs: 'Needs a nested taxonomy' },
    { value: 'swatch',         label: 'Fluid swatches',      hint: 'Real color circles',      needs: 'Needs a color attribute' },
    { value: 'swiper',         label: 'Swipe deck',          hint: 'Tune it in the Playground',    needs: 'Needs a visual source', pro: true },
    { value: 'spin_the_wheel', label: 'Spin the wheel',      hint: 'Gamified single pick',    needs: 'Needs a list of values', pro: true },
    { value: 'matrix',         label: 'Intersection matrix', hint: 'Stack values, match all', needs: 'Needs a list of values', pro: true },
    { value: 'ask',            label: 'Ask',                 hint: 'Set up in Settings → Ask', pro: true, view: true },
    { value: 'visual_dna',     label: 'Visual DNA',          hint: 'Match by image color',    pro: true, view: true },
    { value: 'pagination',     label: 'Pagination',          hint: 'Numbered page links',     view: true },
    { value: 'saved_bin',      label: 'Saved bin',           hint: 'Shoppers pin items',      pro: true, view: true },
];

export const typeDef = (value) => TYPES.find((t) => t.value === value) || null;

export const sourceId = (kind, source) => `${kind}:${source}`;

export const findSource = (sources, facet) =>
    (sources || []).find((s) => s.kind === facet?.kind && s.source === facet?.source) || null;

const plural = (n, one, many) => `${nf.format(n)} ${n === 1 ? one : many}`;

// Text for the Source dropdown: "Attribute: pa_brand (8 values)" and friends.
export function sourceOptionLabel(src) {
    switch (src.group) {
        case 'attribute':
            return `Attribute: ${src.source} (${plural(src.count, 'value', 'values')})`;
        case 'taxonomy':
            return `Taxonomy: ${src.source} (${plural(src.count, 'term', 'terms')})`;
        case 'text':
            return 'Post title';
        default: break;
    }
    if (src.source === '_price') return 'WooCommerce price';
    const name = `${src.integration || 'Field'}: ${src.source}`;
    switch (src.shape) {
        case 'options': return `${name} (${plural(src.count || 0, 'value', 'values')})`;
        case 'numeric': return `${name} (number)`;
        case 'date':    return `${name} (date)`;
        case 'boolean': return `${name} (yes/no)`;
        default:        return name;
    }
}

// Whether a source of this shape can feed the type. Returns null when it
// fits, otherwise the reason (the type's own `needs` line).
export function fitReason(type, src) {
    const def = typeof type === 'string' ? typeDef(type) : type;
    if (!def || def.view) return null;
    const list = src.shape === 'taxonomy' || src.shape === 'options';
    const ok = {
        checkbox: list, radio: list, dropdown: list, spin_the_wheel: list, matrix: list,
        toggle:     src.shape === 'boolean',
        range:      src.shape === 'numeric',
        search:     src.shape === 'text',
        date_range: src.shape === 'date',
        hierarchy:  src.shape === 'taxonomy' && !!src.hierarchical,
        swatch:     src.shape === 'taxonomy' && !!src.visual,
        swiper:     src.shape === 'taxonomy' && !!src.visual,
    }[def.value];
    return ok ? null : def.needs;
}

// Per-type picker state for the current source.
//  - `available`: displays the installed plugins can render (null = all).
//  - `current`:   the facet's stored display; never disabled so a saved facet
//                 isn't silently invalidated by a stricter rule.
export function typeState(def, { facet, source, available, current }) {
    if (Array.isArray(available) && !available.includes(def.value) && def.value !== current) {
        return { disabled: true, subtitle: def.pro ? 'Part of HOF Pro' : 'Not available' };
    }
    if (def.value === current) return { disabled: false, subtitle: def.hint };
    if (def.view) return { disabled: false, subtitle: def.hint };
    if (!facet?.source) return { disabled: true, subtitle: 'Pick a source first' };
    if (!source) return { disabled: false, subtitle: def.hint }; // not in the catalog: can't judge
    const reason = fitReason(def, source);
    return reason ? { disabled: true, subtitle: reason } : { disabled: false, subtitle: def.hint };
}

// The type a source should default to: the integration's own suggestion when
// it fits, otherwise the first type that does.
export function defaultType(src, available = null) {
    const usable = (def) =>
        !def.view &&
        (!Array.isArray(available) || available.includes(def.value)) &&
        fitReason(def, src) === null;
    const suggested = typeDef(src.template?.display);
    if (suggested && usable(suggested)) return suggested.value;
    return (TYPES.find(usable) || TYPES[0]).value;
}

// Explainer card copy, as parts so the UI can bold without injecting HTML.
// { b: true } parts render bold.
export function explainer(src, { noun = 'items' } = {}) {
    const B = (t) => ({ t, b: true });
    const T = (t) => ({ t });
    if (!src) {
        return [T('Pick where the values come from. The source decides which types make sense.')];
    }

    if (src.group === 'text') {
        return [B('Text search'), T(` matches what the shopper types against the ${noun.replace(/s$/, '')} title.`)];
    }

    if (src.group === 'attribute' || src.group === 'taxonomy') {
        const parts = [];
        if (src.group === 'attribute') {
            parts.push(
                B('Attribute'),
                T(' is what WooCommerce calls a product taxonomy such as brand, size or color. '),
                B(src.source),
                T(' is its internal name (pa stands for product attribute). '),
            );
        } else {
            parts.push(
                B('Taxonomy'),
                T(' is a WordPress grouping. '),
                B(src.source),
                T(` is the internal name for ${String(src.title || src.source).toLowerCase()}. `),
            );
        }
        if (src.count === 0) {
            parts.push(T('No terms exist yet, so there is nothing to filter by until you add some.'));
            return parts;
        }
        parts.push(
            B(plural(src.count, src.group === 'attribute' ? 'value' : 'term', src.group === 'attribute' ? 'values' : 'terms')),
            T(` ${src.count === 1 ? 'exists' : 'exist'}`),
        );
        if (src.group === 'taxonomy' && src.nested) parts.push(T(', and some are nested, so Hierarchy is available'));
        parts.push(T('.'));
        const empty = src.empty_terms || [];
        if (empty.length) {
            parts.push(T(` ${empty.join(', ')} ${empty.length === 1 ? 'has' : 'have'} no ${noun} yet.`));
        }
        if (src.visual) {
            parts.push(T(' Each value carries a color or image, so Fluid swatches can render real color circles and Swipe deck can show cards.'));
        }
        return parts;
    }

    // Fields from an integration.
    if (src.source === '_price') {
        return [T('The product’s '), B('price'), T(', read from WooCommerce directly. Numeric, so it becomes a range slider.')];
    }
    const who = { ACF: 'Advanced Custom Fields', 'Meta Box': 'Meta Box', Pods: 'Pods', WooCommerce: 'WooCommerce' }[src.integration] || src.integration;
    const head = [B(src.integration || 'Field'), T(` means the value lives in a ${who} field. `), B(src.source)];
    switch (src.shape) {
        case 'numeric':
            return [...head, T(' is numeric. HOF reads the number and offers a range slider with the real min and max from your content.')];
        case 'date':
            return [...head, T(' is a date, so it becomes a date range.')];
        case 'boolean':
            return [...head, T(' is a yes/no field, so it becomes a toggle.')];
        default:
            return [...head, T(` has ${plural(src.count || 0, 'distinct value', 'distinct values')} across your ${noun}.`)];
    }
}

export const explainerText = (parts) => parts.map((p) => p.t).join('');

// The facet fields a chosen source sets. Name and label are only filled in
// when the facet doesn't have them yet, so renaming survives a source change.
export function sourcePatch(src, facet, available = null) {
    const t = src.template || {};
    const patch = {
        kind: src.kind,
        source: src.source,
        display: defaultType(src, available),
    };
    // Integration suggestions carry settings the display needs (toggle values, resolve).
    if (t.settings && Object.keys(t.settings).length) patch.settings = { ...t.settings };
    else patch.settings = {};
    if (!facet?.name) patch.name = t.name || '';
    if (!facet?.label) patch.label = t.label || '';
    return patch;
}
