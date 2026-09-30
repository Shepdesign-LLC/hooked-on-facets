import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

vi.mock('../../admin/src/api.js', () => ({
    getSources: vi.fn(),
    previewFacet: vi.fn(),
}));

import { getSources, previewFacet } from '../../admin/src/api.js';
import FacetEditor from '../../admin/src/components/FacetEditor.jsx';
import LivePreview from '../../admin/src/components/editor/LivePreview.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const brand = {
    id: 'taxonomy:pa_brand', kind: 'taxonomy', source: 'pa_brand', group: 'attribute', shape: 'taxonomy',
    title: 'Brand', count: 8, empty_terms: ['Tundra'], hierarchical: false, nested: false, visual: false,
    template: { name: 'brand', label: 'Brand', kind: 'taxonomy', source: 'pa_brand', display: 'checkbox', settings: {} },
};
const price = {
    id: 'meta:_price', kind: 'meta', source: '_price', group: 'field', integration: 'WooCommerce', shape: 'numeric',
    title: 'Price', count: null,
    template: { name: 'price', label: 'Price', kind: 'meta', source: '_price', display: 'range', settings: {} },
};

const postTypes = [
    { slug: 'post', label: 'Posts', items: 312, custom: false },
    { slug: 'product', label: 'Products', items: 1200, custom: false },
    { slug: 'guide', label: 'Trail guides', items: 84, custom: true },
];

const answer = (over = {}) => ({
    post_type: { slug: 'product', label: 'products' },
    values: [
        { value: 'alder', label: 'Alder', count: 4, term_id: 1, parent_id: null, depth: 0 },
        { value: 'tundra', label: 'Tundra', count: 0, term_id: 2, parent_id: null, depth: 0 },
    ],
    bounds: { min: null, max: null },
    total: 1200, count: 15, sampled: false, ms: 4.2,
    items: [{ id: 1, title: 'Summit shell', image: '', meta: 'Alder' }],
    ...over,
});

const facet = (over = {}) => ({
    name: 'brand', label: 'Brand', kind: 'taxonomy', source: 'pa_brand', display: 'checkbox', post_type: 'product', settings: {}, ...over,
});

let root;
let host;

const render = async (el) => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root.render(el); });
};

beforeEach(() => {
    getSources.mockReset();
    previewFacet.mockReset();
    getSources.mockResolvedValue({ sources: [brand, price] });
    previewFacet.mockResolvedValue(answer());
});

afterEach(async () => {
    vi.useRealTimers();
    await act(async () => root?.unmount());
    host?.remove();
});

const editor = (props = {}) =>
    createElement(FacetEditor, {
        facet: facet(), onChange: vi.fn(), onDelete: vi.fn(), allFacets: [facet()],
        availableDisplays: ['checkbox', 'radio', 'dropdown', 'range', 'search', 'swatch', 'toggle', 'hierarchy', 'date_range', 'pagination'],
        postTypes, stats: { post_types: postTypes, facets: {} }, ...props,
    });

const typeButton = (label) =>
    [...host.querySelectorAll('.hof-type')].find((b) => b.querySelector('b').textContent === label);

describe('FacetEditor', () => {
    it('orders the steps Applies to, Source, Type, Behavior, Display', async () => {
        await render(editor());
        const heads = [...host.querySelectorAll('.hof-step-head h2')].map((h) => h.textContent);

        expect(heads).toEqual(['Applies to', 'Source', 'Type', 'Behavior', 'Display']);
    });

    it('lists post types Products first, custom A to Z, Posts last', async () => {
        await render(editor());
        const labels = [...host.querySelectorAll('[aria-label="Applies to"] button')].map((b) => b.textContent);

        expect(labels).toEqual(['Products', 'Trail guides', 'Posts']);
        expect(host.querySelector('[aria-label="Applies to"] [aria-pressed="true"]').textContent).toBe('Products');
    });

    it('loads the catalog for the facet\'s post type and groups the source list', async () => {
        await render(editor());

        expect(getSources).toHaveBeenCalledWith('product');
        const groups = [...host.querySelectorAll('select[aria-label="Source"] optgroup')].map((g) => g.label);
        expect(groups).toEqual(['Attributes', 'Fields']);
        const opts = [...host.querySelectorAll('select[aria-label="Source"] option')].map((o) => o.textContent);
        expect(opts).toContain('Attribute: pa_brand (8 values)');
        expect(opts).toContain('WooCommerce price');
    });

    it('writes the explainer from the selected source', async () => {
        await render(editor());
        const text = host.querySelector('.hof-explain').textContent;

        expect(text).toContain('8 values');
        expect(text).toContain('Tundra has no products yet.');
    });

    it('disables types that do not fit and says why', async () => {
        await render(editor());

        expect(typeButton('Range').disabled).toBe(true);
        expect(typeButton('Range').querySelector('small').textContent).toBe('Needs a number');
        expect(typeButton('Hierarchy').querySelector('small').textContent).toBe('Needs a nested taxonomy');
        expect(typeButton('Radio').disabled).toBe(false);
    });

    it('tags Pro types and marks them unavailable without the add-on', async () => {
        await render(editor());
        const swipe = typeButton('Swipe deck');

        expect(swipe.querySelector('.hof-tag').textContent).toBe('Pro');
        expect(swipe.disabled).toBe(true);
        expect(swipe.querySelector('small').textContent).toBe('Part of HOF Pro');
    });

    it('changing the source resets the type to one that fits', async () => {
        const onChange = vi.fn();
        await render(editor({ onChange }));
        const select = host.querySelector('select[aria-label="Source"]');

        await act(async () => {
            select.value = 'meta:_price';
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ kind: 'meta', source: '_price', display: 'range' }));
    });

    it('changing Applies to starts the source over', async () => {
        const onChange = vi.fn();
        await render(editor({ onChange }));
        const guides = [...host.querySelectorAll('[aria-label="Applies to"] button')].find((b) => b.textContent === 'Trail guides');

        await act(async () => guides.click());

        expect(onChange).toHaveBeenCalledWith({ post_type: 'guide', kind: 'taxonomy', source: '', display: 'checkbox', settings: {} });
    });

    it('picking a type sets the display; a view type clears the source', async () => {
        const onChange = vi.fn();
        await render(editor({ onChange }));

        await act(async () => typeButton('Radio').click());
        expect(onChange).toHaveBeenLastCalledWith({ display: 'radio' });

        await act(async () => typeButton('Pagination').click());
        expect(onChange).toHaveBeenLastCalledWith({ display: 'pagination', kind: 'view', source: '' });
    });

    it('keeps the slug in step with the name until the slug is edited', async () => {
        const onChange = vi.fn();
        await render(editor({ onChange, facet: facet({ name: 'brand', label: 'Brand' }) }));
        const name = host.querySelector('input[aria-label="Facet name"]');
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;

        await act(async () => {
            set.call(name, 'Trail brand');
            name.dispatchEvent(new Event('input', { bubbles: true }));
        });

        expect(onChange).toHaveBeenCalledWith({ label: 'Trail brand', name: 'trail_brand' });
    });

    it('does not rewrite a slug the user set by hand', async () => {
        const onChange = vi.fn();
        await render(editor({ onChange, facet: facet({ name: 'custom_slug', label: 'Brand' }) }));
        const name = host.querySelector('input[aria-label="Facet name"]');
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;

        await act(async () => {
            set.call(name, 'Brands');
            name.dispatchEvent(new Event('input', { bubbles: true }));
        });

        expect(onChange).toHaveBeenCalledWith({ label: 'Brands' });
    });

    it('shows the Match control only for multi-value types, with its tooltip', async () => {
        await render(editor());
        const tip = [...host.querySelectorAll('.hof-tip')].find((t) => t.dataset.tip.startsWith('Any: show items'));

        expect(tip).toBeTruthy();
        expect(tip.getAttribute('tabindex')).toBe('0');

        await act(async () => root.unmount());
        host.remove();
        await render(editor({ facet: facet({ display: 'radio' }) }));
        expect([...host.querySelectorAll('.hof-tip')].some((t) => t.dataset.tip.startsWith('Any: show items'))).toBe(false);
    });

    it('gives Applies to, Source and Type a tooltip each', async () => {
        await render(editor());
        const tips = [...host.querySelectorAll('.hof-step-head .hof-tip')].map((t) => t.dataset.tip.slice(0, 24));

        expect(tips).toHaveLength(3);
    });

    it('shows the shortcode for the facet slug', async () => {
        await render(editor());

        expect(host.querySelector('.hof-place-card code').textContent).toBe('[hof_facet name="brand"]');
        expect(host.textContent).toContain('Hooked Facet');
    });

    it('keeps a saved source the catalog does not know reachable', async () => {
        await render(editor({ facet: facet({ source: 'legacy_tax' }) }));
        const opts = [...host.querySelectorAll('select[aria-label="Source"] option')].map((o) => o.textContent);

        expect(opts).toContain('Taxonomy: legacy_tax');
        // Not in the catalog, so nothing is disabled on a guess.
        expect(typeButton('Range').disabled).toBe(false);
    });

    it('keeps the settings the previous editor exposed', async () => {
        await render(editor({ facet: facet({ display: 'toggle', kind: 'meta', source: '_stock_status' }) }));

        expect(host.textContent).toContain('True value (in the index)');
        expect(host.textContent).toContain('On label (optional)');
    });
});

describe('LivePreview', () => {
    it('waits 150 ms before querying', async () => {
        vi.useFakeTimers();
        await render(createElement(LivePreview, { facet: facet(), postType: 'product' }));

        expect(previewFacet).not.toHaveBeenCalled();
        await act(async () => { vi.advanceTimersByTime(149); });
        expect(previewFacet).not.toHaveBeenCalled();
        await act(async () => { vi.advanceTimersByTime(1); });
        expect(previewFacet).toHaveBeenCalledTimes(1);
    });

    it('sends the unsaved config and renders real values and results', async () => {
        vi.useFakeTimers();
        await render(createElement(LivePreview, { facet: facet({ name: '' }), postType: 'product' }));
        await act(async () => { vi.advanceTimersByTime(150); });

        const [sent] = previewFacet.mock.calls[0];
        expect(sent).toMatchObject({ name: 'preview', kind: 'taxonomy', source: 'pa_brand', display: 'checkbox', post_type: 'product' });
        expect(host.querySelector('.hof-lp-count').textContent).toBe('15 of 1,200 products');
        expect(host.querySelectorAll('.hof-pv-row')).toHaveLength(2);
        expect(host.querySelector('.hof-lp-card b').textContent).toBe('Summit shell');
        expect(host.querySelector('.hof-lp-stats').textContent).toContain('4.2 ms');
    });

    it('dims values with no results', async () => {
        vi.useFakeTimers();
        await render(createElement(LivePreview, { facet: facet(), postType: 'product' }));
        await act(async () => { vi.advanceTimersByTime(150); });

        const rows = [...host.querySelectorAll('.hof-pv-row')];
        expect(rows.find((r) => r.textContent.includes('Tundra')).classList.contains('is-dim')).toBe(true);
        expect(rows.find((r) => r.textContent.includes('Alder')).classList.contains('is-dim')).toBe(false);
    });

    it('re-queries when the preview facet is used, once per burst', async () => {
        vi.useFakeTimers();
        await render(createElement(LivePreview, { facet: facet(), postType: 'product' }));
        await act(async () => { vi.advanceTimersByTime(150); });
        previewFacet.mockClear();
        previewFacet.mockResolvedValue(answer({ count: 4 }));

        const alder = [...host.querySelectorAll('.hof-pv-row')].find((r) => r.textContent.includes('Alder')).querySelector('input');
        await act(async () => alder.click());
        await act(async () => { vi.advanceTimersByTime(100); });
        const tundra = [...host.querySelectorAll('.hof-pv-row')].find((r) => r.textContent.includes('Tundra')).querySelector('input');
        await act(async () => tundra.click());
        await act(async () => { vi.advanceTimersByTime(150); });

        expect(previewFacet).toHaveBeenCalledTimes(1);
        expect(previewFacet.mock.calls[0][1]).toMatchObject({ values: ['alder', 'tundra'], match: 'any' });
    });

    it('passes the facet\'s match mode with the selection', async () => {
        vi.useFakeTimers();
        await render(createElement(LivePreview, { facet: facet({ settings: { match: 'all' } }), postType: 'product' }));
        await act(async () => { vi.advanceTimersByTime(150); });

        expect(previewFacet.mock.calls[0][1].match).toBe('all');
    });

    it('drops a stale response that arrives after a newer request', async () => {
        vi.useFakeTimers();
        let resolveFirst;
        previewFacet.mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }));
        previewFacet.mockResolvedValueOnce(answer({ count: 2 }));
        await render(createElement(LivePreview, { facet: facet(), postType: 'product' }));
        await act(async () => { vi.advanceTimersByTime(150); });

        const alder = [...host.querySelectorAll('.hof-pv-row')];
        expect(alder).toHaveLength(0); // first response still pending

        // A change while the first is in flight (re-render with a new source).
        await act(async () => {
            root.render(createElement(LivePreview, { facet: facet({ source: 'pa_color' }), postType: 'product' }));
        });
        await act(async () => { vi.advanceTimersByTime(150); });
        expect(host.querySelector('.hof-lp-count').textContent).toBe('2 of 1,200 products');

        await act(async () => resolveFirst(answer({ count: 999 })));
        expect(host.querySelector('.hof-lp-count').textContent).toBe('2 of 1,200 products');
    });

    it('shows the empty state when the facet has no values yet', async () => {
        vi.useFakeTimers();
        previewFacet.mockResolvedValue(answer({ values: [], count: 84, total: 84, post_type: { slug: 'guide', label: 'trail guides' } }));
        await render(createElement(LivePreview, { facet: facet({ source: 'season' }), postType: 'guide' }));
        await act(async () => { vi.advanceTimersByTime(150); });

        expect(host.querySelector('.hof-pv-facet .hof-empty-state').textContent)
            .toBe('No values yet. Tag some trail guides with a season and they appear here.');
    });

    it('asks for a source instead of querying when none is chosen', async () => {
        vi.useFakeTimers();
        await render(createElement(LivePreview, { facet: facet({ source: '' }), postType: 'product' }));
        await act(async () => { vi.advanceTimersByTime(500); });

        expect(previewFacet).not.toHaveBeenCalled();
        expect(host.textContent).toContain('Pick a source');
    });

    it('does not query for types it can only illustrate', async () => {
        vi.useFakeTimers();
        await render(createElement(LivePreview, { facet: facet({ display: 'pagination', kind: 'view', source: '' }), postType: 'product' }));
        await act(async () => { vi.advanceTimersByTime(500); });

        expect(previewFacet).not.toHaveBeenCalled();
        expect(host.querySelector('.hof-preview')).toBeTruthy();
    });

    it('starts the selection over when the source changes', async () => {
        vi.useFakeTimers();
        await render(createElement(LivePreview, { facet: facet(), postType: 'product' }));
        await act(async () => { vi.advanceTimersByTime(150); });
        const alder = [...host.querySelectorAll('.hof-pv-row')].find((r) => r.textContent.includes('Alder')).querySelector('input');
        await act(async () => alder.click());
        await act(async () => { vi.advanceTimersByTime(150); });
        previewFacet.mockClear();

        await act(async () => {
            root.render(createElement(LivePreview, { facet: facet({ source: 'pa_color' }), postType: 'product' }));
        });
        await act(async () => { vi.advanceTimersByTime(150); });

        expect(previewFacet.mock.calls[0][1].values).toEqual([]);
    });
});
