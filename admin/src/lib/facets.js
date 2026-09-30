// Pure helpers for presenting facets: labels, post-type resolution and the
// grouping the Facets list renders. Kept free of React so they unit-test.

// Short names for the Type chip. Slugs are the stored `display` values.
export const DISPLAY_LABELS = {
    checkbox: 'Checkbox',
    radio: 'Radio',
    dropdown: 'Dropdown',
    hierarchy: 'Hierarchy',
    range: 'Range',
    date_range: 'Date range',
    toggle: 'Toggle',
    search: 'Search',
    swatch: 'Fluid swatches',
    swiper: 'Swipe deck',
    spin_the_wheel: 'Spin the wheel',
    matrix: 'Intersection matrix',
    pagination: 'Pagination',
    saved_bin: 'Saved bin',
    ask: 'Ask',
    visual_dna: 'Visual DNA',
};

export const displayLabel = (display) => DISPLAY_LABELS[display] || display || '';

// Displays that span every indexed post type rather than one.
const EVERYWHERE_DISPLAYS = new Set(['search', 'ask']);

// Displays whose "values" aren't a discrete list, so a count means nothing.
const VALUELESS_DISPLAYS = new Set([
    'range', 'date_range', 'search', 'ask', 'pagination', 'visual_dna', 'saved_bin',
]);

export const isEverywhere = (facet) => EVERYWHERE_DISPLAYS.has(facet?.display);

export const hasValueCount = (facet) => !VALUELESS_DISPLAYS.has(facet?.display);

// "Attribute: pa_brand", "Taxonomy: product_cat", "WooCommerce price" …
export function sourceLabel(facet) {
    if (!facet) return '';
    switch (facet.display) {
        case 'ask':        return 'All indexed fields';
        case 'visual_dna': return facet.settings?.target_facet
            ? `Color facet: ${facet.settings.target_facet}`
            : 'Color match';
        case 'pagination': return 'Results region';
        case 'saved_bin':  return 'Saved items';
        default: break;
    }
    const source = facet.source || '';
    if (!source) return '';
    if (facet.kind === 'taxonomy') {
        return source.startsWith('pa_') ? `Attribute: ${source}` : `Taxonomy: ${source}`;
    }
    if (facet.kind === 'meta') {
        return source === '_price' ? 'WooCommerce price' : `Field: ${source}`;
    }
    if (facet.kind === 'field') {
        return source === 'post_title' ? 'Post title' : `Post field: ${source}`;
    }
    return source;
}

// The post type a facet belongs to: an explicit choice, else what the index
// says (the server resolves this), else nothing.
export function postTypeOf(facet, stats) {
    return facet?.post_type || stats?.facets?.[facet?.name]?.post_type || '';
}

const titleCase = (slug) =>
    String(slug || '')
        .replace(/[_-]+/g, ' ')
        .replace(/^./, (c) => c.toUpperCase());

// Products first, custom post types A→Z, Posts last. Anything without a slug
// (unresolved) sorts after everything else.
export function postTypeRank(slug, label = slug) {
    if (slug === 'product') return [0, ''];
    if (slug === 'post') return [2, ''];
    if (!slug) return [3, ''];
    return [1, String(label).toLowerCase()];
}

export function orderPostTypes(types) {
    return [...(types || [])].sort((a, b) => {
        const [ra, la] = postTypeRank(a.slug, a.label);
        const [rb, lb] = postTypeRank(b.slug, b.label);
        return ra - rb || la.localeCompare(lb);
    });
}

/**
 * Group facets for the list.
 *
 * Order: Everywhere (search / ask), Products, custom post types A→Z, Posts,
 * then anything unresolved. Empty groups are dropped. Each entry keeps the
 * facet's index in the flat array so row actions edit the right one.
 *
 * @returns {{key:string,label:string,slug:string,items:(number|null),entries:{facet:object,index:number}[]}[]}
 */
export function groupFacets(facets, stats) {
    const types = new Map((stats?.post_types || []).map((p) => [p.slug, p]));
    const everywhere = [];
    const byType = new Map();

    (facets || []).forEach((facet, index) => {
        const entry = { facet, index };
        if (isEverywhere(facet)) {
            everywhere.push(entry);
            return;
        }
        const slug = postTypeOf(facet, stats);
        if (!byType.has(slug)) byType.set(slug, []);
        byType.get(slug).push(entry);
    });

    const labelFor = (slug) => types.get(slug)?.label || (slug ? titleCase(slug) : 'Other');

    const slugs = [...byType.keys()];
    const middle = slugs
        .filter((s) => s && s !== 'product' && s !== 'post')
        .sort((a, b) => labelFor(a).localeCompare(labelFor(b)));
    const ordered = [
        ...(slugs.includes('product') ? ['product'] : []),
        ...middle,
        ...(slugs.includes('post') ? ['post'] : []),
        ...(slugs.includes('') ? [''] : []),
    ];

    const groups = [];
    if (everywhere.length) {
        groups.push({
            key: 'everywhere',
            label: 'Everywhere',
            slug: 'all post types',
            items: null,
            entries: everywhere,
        });
    }
    ordered.forEach((slug) => {
        groups.push({
            key: `pt:${slug}`,
            label: labelFor(slug),
            slug,
            items: types.has(slug) ? types.get(slug).items : null,
            entries: byType.get(slug),
        });
    });
    return groups;
}

// Row status for the pill. Facets the index hasn't seen yet (new, unsaved)
// read as not indexed.
export function facetStatus(facet, stats) {
    return stats?.facets?.[facet?.name]?.status || 'pending';
}

// Distinct-value count, or null when the number isn't meaningful.
export function facetValues(facet, stats) {
    if (!hasValueCount(facet)) return null;
    const row = stats?.facets?.[facet?.name];
    return row ? row.values : null;
}

/**
 * Turn integration suggestions into at most `limit` entries the "Found in
 * your content" strip can show, skipping anything that already has a facet.
 */
export function pickSuggestions(suggestions, facets, stats, limit = 3) {
    const taken = new Set((facets || []).map((f) => f.name));
    const types = new Map((stats?.post_types || []).map((p) => [p.slug, p.label]));
    const seen = new Set();
    const out = [];
    for (const facet of suggestions || []) {
        if (!facet?.name || taken.has(facet.name) || seen.has(facet.name)) continue;
        seen.add(facet.name);
        const pt = facet.post_type ? types.get(facet.post_type) || titleCase(facet.post_type) : '';
        out.push({ facet, prefix: pt, label: facet.label || facet.name, display: displayLabel(facet.display) });
        if (out.length === limit) break;
    }
    return out;
}
