import { describe, expect, it } from 'vitest';
import {
    facetStatus,
    facetValues,
    groupFacets,
    pickSuggestions,
    postTypeOf,
    sourceLabel,
} from '../../admin/src/lib/facets.js';

const stats = {
    post_types: [
        { slug: 'product', label: 'Products', items: 1200, custom: false },
        { slug: 'guide', label: 'Trail guides', items: 84, custom: true },
        { slug: 'dealer', label: 'Dealers', items: 9, custom: true },
        { slug: 'post', label: 'Posts', items: 312, custom: false },
    ],
    facets: {
        brand: { values: 8, post_type: 'product', status: 'indexed' },
        region: { values: 5, post_type: 'guide', status: 'indexing' },
        price: { values: 40, post_type: 'product', status: 'indexed' },
        tags: { values: 41, post_type: 'post', status: 'indexed' },
        stores: { values: 3, post_type: 'dealer', status: 'indexed' },
    },
};

const f = (name, display, extra = {}) => ({ name, label: name, display, kind: 'taxonomy', source: name, ...extra });

describe('groupFacets', () => {
    it('orders Everywhere, Products, custom post types A→Z, then Posts', () => {
        const groups = groupFacets(
            [
                f('tags', 'checkbox'),
                f('region', 'checkbox'),
                f('stores', 'checkbox'),
                f('brand', 'checkbox'),
                f('q', 'search', { kind: 'field', source: 'post_title' }),
            ],
            stats
        );

        expect(groups.map((g) => g.label)).toEqual([
            'Everywhere', 'Products', 'Dealers', 'Trail guides', 'Posts',
        ]);
    });

    it('puts search and ask under Everywhere regardless of post type', () => {
        const groups = groupFacets(
            [f('a', 'ask', { kind: 'view', post_type: 'product' }), f('q', 'search', { post_type: 'guide' })],
            stats
        );

        expect(groups).toHaveLength(1);
        expect(groups[0].key).toBe('everywhere');
        expect(groups[0].entries.map((e) => e.facet.name)).toEqual(['a', 'q']);
    });

    it('carries the post type slug and indexed item count on the header', () => {
        const [products] = groupFacets([f('brand', 'checkbox')], stats);

        expect(products.slug).toBe('product');
        expect(products.items).toBe(1200);
    });

    it('drops post types that have no facets', () => {
        const groups = groupFacets([f('brand', 'checkbox')], stats);

        expect(groups.map((g) => g.slug)).toEqual(['product']);
    });

    it('keeps each facet\'s index in the flat array', () => {
        const groups = groupFacets(
            [f('region', 'checkbox'), f('brand', 'checkbox'), f('price', 'range')],
            stats
        );
        const products = groups.find((g) => g.slug === 'product');

        expect(products.entries.map((e) => e.index)).toEqual([1, 2]);
    });

    it('prefers an explicit post_type over the index', () => {
        const groups = groupFacets([f('brand', 'checkbox', { post_type: 'guide' })], stats);

        expect(groups[0].slug).toBe('guide');
    });

    it('files unresolved facets under Other, last', () => {
        const groups = groupFacets([f('mystery', 'checkbox'), f('tags', 'checkbox')], stats);

        expect(groups.map((g) => g.label)).toEqual(['Posts', 'Other']);
    });

    it('works before stats have loaded', () => {
        const groups = groupFacets([f('brand', 'checkbox', { post_type: 'product' })], null);

        expect(groups[0].label).toBe('Product');
        expect(groups[0].items).toBeNull();
    });
});

describe('row helpers', () => {
    it('labels sources the way the mockup does', () => {
        expect(sourceLabel(f('brand', 'checkbox', { source: 'pa_brand' }))).toBe('Attribute: pa_brand');
        expect(sourceLabel(f('cat', 'hierarchy', { source: 'product_cat' }))).toBe('Taxonomy: product_cat');
        expect(sourceLabel(f('price', 'range', { kind: 'meta', source: '_price' }))).toBe('WooCommerce price');
        expect(sourceLabel(f('d', 'radio', { kind: 'meta', source: 'difficulty' }))).toBe('Field: difficulty');
        expect(sourceLabel(f('ask', 'ask', { kind: 'view', source: '' }))).toBe('All indexed fields');
    });

    it('shows no value count for range, search and other non-list displays', () => {
        expect(facetValues(f('price', 'range'), stats)).toBeNull();
        expect(facetValues(f('brand', 'checkbox'), stats)).toBe(8);
        expect(facetValues(f('new', 'checkbox'), stats)).toBeNull();
    });

    it('reads status from the index, defaulting to pending', () => {
        expect(facetStatus(f('region', 'checkbox'), stats)).toBe('indexing');
        expect(facetStatus(f('unsaved', 'checkbox'), stats)).toBe('pending');
    });

    it('resolves the post type from the facet first, then the index', () => {
        expect(postTypeOf({ name: 'x', post_type: 'guide' }, stats)).toBe('guide');
        expect(postTypeOf({ name: 'brand' }, stats)).toBe('product');
        expect(postTypeOf({ name: 'nope' }, stats)).toBe('');
    });
});

describe('pickSuggestions', () => {
    const suggested = [
        f('brand', 'checkbox', { post_type: 'product' }),
        f('season', 'checkbox', { post_type: 'guide' }),
        f('color', 'swatch', { post_type: 'product' }),
        f('season', 'checkbox', { post_type: 'guide' }),
        f('distance', 'range', { kind: 'meta', post_type: 'guide' }),
        f('extra', 'checkbox'),
    ];

    it('skips facets that already exist and de-duplicates', () => {
        const out = pickSuggestions(suggested, [{ name: 'brand' }], stats);

        expect(out.map((s) => s.facet.name)).toEqual(['season', 'color', 'distance']);
    });

    it('caps at three', () => {
        expect(pickSuggestions(suggested, [], stats)).toHaveLength(3);
    });

    it('builds the "Post type: Label → type" parts', () => {
        const [first] = pickSuggestions(suggested, [{ name: 'brand' }], stats);

        expect(first).toMatchObject({ prefix: 'Trail guides', label: 'season', display: 'Checkbox' });
    });
});
