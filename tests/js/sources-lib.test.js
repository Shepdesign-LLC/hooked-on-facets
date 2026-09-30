import { describe, expect, it } from 'vitest';
import {
    defaultType,
    explainer,
    explainerText,
    findSource,
    fitReason,
    sourceOptionLabel,
    sourcePatch,
    typeDef,
    typeState,
} from '../../admin/src/lib/sources.js';

const brand = {
    id: 'taxonomy:pa_brand', kind: 'taxonomy', source: 'pa_brand', group: 'attribute', shape: 'taxonomy',
    title: 'Brand', count: 8, empty_terms: ['Tundra'], hierarchical: false, nested: false, visual: false,
    template: { name: 'brand', label: 'Brand', kind: 'taxonomy', source: 'pa_brand', display: 'checkbox', settings: {} },
};
const category = {
    id: 'taxonomy:product_cat', kind: 'taxonomy', source: 'product_cat', group: 'taxonomy', shape: 'taxonomy',
    title: 'Category', count: 23, empty_terms: [], hierarchical: true, nested: true, visual: false,
    template: { name: 'category', label: 'Category', kind: 'taxonomy', source: 'product_cat', display: 'hierarchy', settings: {} },
};
const color = {
    id: 'taxonomy:pa_color', kind: 'taxonomy', source: 'pa_color', group: 'attribute', shape: 'taxonomy',
    title: 'Color', count: 8, empty_terms: [], hierarchical: false, nested: false, visual: true,
    template: { name: 'color', label: 'Color', kind: 'taxonomy', source: 'pa_color', display: 'swatch', settings: {} },
};
const price = {
    id: 'meta:_price', kind: 'meta', source: '_price', group: 'field', integration: 'WooCommerce', shape: 'numeric',
    title: 'Price', count: null,
    template: { name: 'price', label: 'Price', kind: 'meta', source: '_price', display: 'range', settings: {} },
};
const difficulty = {
    id: 'meta:difficulty', kind: 'meta', source: 'difficulty', group: 'field', integration: 'ACF', shape: 'options',
    title: 'Difficulty', count: 3,
    template: { name: 'difficulty', label: 'Difficulty', kind: 'meta', source: 'difficulty', display: 'radio', settings: {} },
};
const title = {
    id: 'field:post_title', kind: 'field', source: 'post_title', group: 'text', shape: 'text', title: 'Title', count: null,
    template: { name: 'search', label: 'Search', kind: 'field', source: 'post_title', display: 'search', settings: {} },
};

describe('sourceOptionLabel', () => {
    it('matches the mockup wording', () => {
        expect(sourceOptionLabel(brand)).toBe('Attribute: pa_brand (8 values)');
        expect(sourceOptionLabel(category)).toBe('Taxonomy: product_cat (23 terms)');
        expect(sourceOptionLabel(price)).toBe('WooCommerce price');
        expect(sourceOptionLabel(difficulty)).toBe('ACF: difficulty (3 values)');
        expect(sourceOptionLabel(title)).toBe('Post title');
    });

    it('singularises a count of one', () => {
        expect(sourceOptionLabel({ ...brand, count: 1 })).toBe('Attribute: pa_brand (1 value)');
    });
});

describe('fitReason', () => {
    it('lets list types read taxonomies and option fields', () => {
        for (const t of ['checkbox', 'radio', 'dropdown']) {
            expect(fitReason(t, brand)).toBeNull();
            expect(fitReason(t, difficulty)).toBeNull();
        }
    });

    it('explains why a type does not fit', () => {
        expect(fitReason('range', brand)).toBe('Needs a number');
        expect(fitReason('hierarchy', brand)).toBe('Needs a nested taxonomy');
        expect(fitReason('swatch', brand)).toBe('Needs a color attribute');
        expect(fitReason('swiper', brand)).toBe('Needs a visual source');
        expect(fitReason('search', brand)).toBe('Needs text');
        expect(fitReason('checkbox', price)).toBe('Needs a list of values');
        expect(fitReason('toggle', brand)).toBe('Needs a yes/no field');
        expect(fitReason('date_range', price)).toBe('Needs a date');
    });

    it('fits the specialised types to the right sources', () => {
        expect(fitReason('hierarchy', category)).toBeNull();
        expect(fitReason('swatch', color)).toBeNull();
        expect(fitReason('swiper', color)).toBeNull();
        expect(fitReason('range', price)).toBeNull();
        expect(fitReason('search', title)).toBeNull();
    });

    it('never blocks view types, which read no source', () => {
        for (const t of ['ask', 'visual_dna', 'pagination', 'saved_bin']) {
            expect(fitReason(t, price)).toBeNull();
        }
    });
});

describe('typeState', () => {
    const ctx = (over = {}) => ({ facet: { source: 'pa_brand' }, source: brand, available: null, current: 'checkbox', ...over });

    it('disables unfit types and puts the reason in the subtitle', () => {
        expect(typeState(typeDef('range'), ctx())).toEqual({ disabled: true, subtitle: 'Needs a number' });
    });

    it('enables fitting types with their hint', () => {
        expect(typeState(typeDef('radio'), ctx())).toEqual({ disabled: false, subtitle: 'Pick one' });
    });

    it('never disables the facet\'s stored type, even when stricter rules would', () => {
        const state = typeState(typeDef('swiper'), ctx({ current: 'swiper' }));

        expect(state.disabled).toBe(false);
    });

    it('marks Pro types unavailable when the add-on is inactive', () => {
        const state = typeState(typeDef('swiper'), ctx({ source: color, available: ['checkbox', 'swatch'] }));

        expect(state).toEqual({ disabled: true, subtitle: 'Part of HOF Pro' });
    });

    it('asks for a source first when none is chosen', () => {
        expect(typeState(typeDef('checkbox'), ctx({ facet: {}, source: null, current: '' })))
            .toEqual({ disabled: true, subtitle: 'Pick a source first' });
    });

    it('does not judge a source that is not in the catalog', () => {
        expect(typeState(typeDef('range'), ctx({ source: null, facet: { source: 'legacy' } })).disabled).toBe(false);
    });
});

describe('defaultType', () => {
    it('uses the integration suggestion when it fits', () => {
        expect(defaultType(category)).toBe('hierarchy');
        expect(defaultType(color)).toBe('swatch');
        expect(defaultType(price)).toBe('range');
        expect(defaultType(title)).toBe('search');
    });

    it('falls back to the first type that fits', () => {
        expect(defaultType({ ...brand, template: { display: 'range' } })).toBe('checkbox');
    });

    it('skips types the install cannot render', () => {
        expect(defaultType(color, ['checkbox'])).toBe('checkbox');
    });
});

describe('sourcePatch', () => {
    it('sets kind, source and the default display', () => {
        expect(sourcePatch(price, {})).toMatchObject({ kind: 'meta', source: '_price', display: 'range' });
    });

    it('fills name and label only when the facet has none', () => {
        expect(sourcePatch(brand, {})).toMatchObject({ name: 'brand', label: 'Brand' });

        const patch = sourcePatch(brand, { name: 'maker', label: 'Maker' });
        expect(patch).not.toHaveProperty('name');
        expect(patch).not.toHaveProperty('label');
    });

    it('carries the integration\'s settings and clears stale ones', () => {
        const toggle = { ...price, template: { ...price.template, display: 'toggle', settings: { true_value: 'instock' } }, shape: 'boolean' };

        expect(sourcePatch(toggle, {}).settings).toEqual({ true_value: 'instock' });
        expect(sourcePatch(brand, { settings: { true_value: 'x' } }).settings).toEqual({});
    });
});

describe('explainer', () => {
    it('is generated from the catalog numbers, not hardcoded', () => {
        const a = explainerText(explainer(brand, { noun: 'products' }));
        const b = explainerText(explainer({ ...brand, count: 12, empty_terms: [] }, { noun: 'products' }));

        expect(a).toContain('8 values');
        expect(a).toContain('Tundra has no products yet.');
        expect(b).toContain('12 values');
        expect(b).not.toContain('Tundra');
    });

    it('explains an attribute', () => {
        expect(explainerText(explainer(brand))).toContain('pa_brand is its internal name (pa stands for product attribute).');
    });

    it('explains a nested taxonomy', () => {
        const text = explainerText(explainer(category));

        expect(text).toContain('23 terms');
        expect(text).toContain('some are nested, so Hierarchy is available');
    });

    it('mentions swatches for a visual attribute', () => {
        expect(explainerText(explainer(color))).toContain('Fluid swatches can render real color circles');
    });

    it('explains the price, an integration field and title search', () => {
        expect(explainerText(explainer(price))).toContain('read from WooCommerce directly');
        expect(explainerText(explainer(difficulty, { noun: 'guides' }))).toContain('has 3 distinct values across your guides');
        expect(explainerText(explainer(title, { noun: 'products' }))).toContain('against the product title');
    });

    it('bolds the key terms', () => {
        const bold = explainer(brand).filter((p) => p.b).map((p) => p.t);

        expect(bold).toEqual(['Attribute', 'pa_brand', '8 values']);
    });

    it('prompts for a source when none is picked', () => {
        expect(explainerText(explainer(null))).toContain('Pick where the values come from');
    });
});

describe('findSource', () => {
    it('matches on kind and source', () => {
        expect(findSource([brand, price], { kind: 'meta', source: '_price' })).toBe(price);
        expect(findSource([brand], { kind: 'taxonomy', source: 'nope' })).toBeNull();
    });
});
