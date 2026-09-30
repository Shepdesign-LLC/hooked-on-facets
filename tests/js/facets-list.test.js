import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import FacetsList from '../../admin/src/components/FacetsList.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const stats = {
    post_types: [
        { slug: 'product', label: 'Products', items: 1200, custom: false },
        { slug: 'guide', label: 'Trail guides', items: 84, custom: true },
    ],
    facets: {
        brand: { values: 8, post_type: 'product', status: 'indexed' },
        color: { values: 8, post_type: 'product', status: 'indexing' },
        region: { values: 5, post_type: 'guide', status: 'indexed' },
        fresh: { values: 0, post_type: 'product', status: 'pending' },
    },
};

const facets = [
    { name: 'brand', label: 'Brand', display: 'checkbox', kind: 'taxonomy', source: 'pa_brand' },
    { name: 'color', label: 'Color', display: 'swatch', kind: 'taxonomy', source: 'pa_color' },
    { name: 'region', label: 'Region', display: 'checkbox', kind: 'taxonomy', source: 'region' },
    { name: 'q', label: 'Site search', display: 'search', kind: 'field', source: 'post_title' },
];

let root;
let host;

function mount(props = {}) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const handlers = {
        onOpen: vi.fn(), onAdd: vi.fn(), onAddSuggestion: vi.fn(),
        onDuplicate: vi.fn(), onDelete: vi.fn(), onMove: vi.fn(),
    };
    act(() => {
        root.render(createElement(FacetsList, { facets, stats, suggestions: [], ...handlers, ...props }));
    });
    return handlers;
}

afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
});

describe('FacetsList', () => {
    it('renders group headers with slug and indexed item count', () => {
        mount();
        const headers = [...host.querySelectorAll('.hof-table-group')].map((r) => r.textContent.replace(/\s+/g, ' ').trim());

        expect(headers).toEqual([
            'Everywhere · all post types',
            'Products · product · 1,200 items',
            'Trail guides · guide · 84 items',
        ]);
    });

    it('shows Values and a Status pill per row', () => {
        mount();
        const rows = [...host.querySelectorAll('.hof-table-row')];
        const color = rows.find((r) => r.textContent.includes('Color'));
        const brand = rows.find((r) => r.textContent.includes('Brand'));

        expect(brand.querySelector('.hof-num').textContent).toBe('8');
        expect(brand.querySelector('.hof-pill-good').textContent).toBe('Indexed');
        expect(color.querySelector('.hof-pill-busy').textContent).toBe('Indexing');
    });

    it('opens the editor with the row\'s flat index', () => {
        const { onOpen } = mount();
        const region = [...host.querySelectorAll('.hof-table-row')].find((r) => r.textContent.includes('Region'));

        act(() => region.click());

        expect(onOpen).toHaveBeenCalledWith(2);
    });

    it('row actions do not also open the editor', () => {
        const { onOpen, onDelete } = mount();
        const brand = [...host.querySelectorAll('.hof-table-row')].find((r) => r.textContent.includes('Brand'));

        act(() => brand.querySelector('[aria-label="Delete facet"]').click());

        expect(onDelete).toHaveBeenCalledWith(0);
        expect(onOpen).not.toHaveBeenCalled();
    });

    it('moves a facet within its own group only', () => {
        const { onMove } = mount();
        const color = [...host.querySelectorAll('.hof-table-row')].find((r) => r.textContent.includes('Color'));

        act(() => color.querySelector('[aria-label="Move up"]').click());

        expect(onMove).toHaveBeenCalledWith(1, 0);
    });

    it('disables move up on the first row of a group and move down on the last', () => {
        mount();
        const brand = [...host.querySelectorAll('.hof-table-row')].find((r) => r.textContent.includes('Brand'));
        const color = [...host.querySelectorAll('.hof-table-row')].find((r) => r.textContent.includes('Color'));

        expect(brand.querySelector('[aria-label="Move up"]').disabled).toBe(true);
        expect(color.querySelector('[aria-label="Move down"]').disabled).toBe(true);
    });

    it('renders the Found in your content strip and opens a suggestion', () => {
        const suggestion = { name: 'season', label: 'Season', display: 'checkbox', kind: 'taxonomy', source: 'season' };
        const { onAddSuggestion } = mount({
            suggestions: [{ facet: suggestion, prefix: 'Trail guides', label: 'Season', display: 'Checkbox' }],
        });
        const strip = host.querySelector('.hof-suggest');

        expect(strip.textContent).toContain('Found in your content');
        const button = strip.querySelector('button');
        expect(button.textContent.replace(/\s+/g, ' ')).toBe('Trail guides: Season → checkbox');

        act(() => button.click());
        expect(onAddSuggestion).toHaveBeenCalledWith(suggestion);
    });

    it('omits the strip when there is nothing to suggest', () => {
        mount();

        expect(host.querySelector('.hof-suggest')).toBeNull();
    });

    it('shows a dash for facets without a value count', () => {
        mount();
        const search = [...host.querySelectorAll('.hof-table-row')].find((r) => r.textContent.includes('Site search'));

        expect(search.querySelector('.hof-num').textContent).toBe('—');
    });

    it('shows not indexed for a facet the index has not seen', () => {
        mount({ facets: [...facets, { name: 'new', label: 'New', display: 'checkbox', kind: 'taxonomy', source: 'x', post_type: 'product' }] });
        const row = [...host.querySelectorAll('.hof-table-row')].find((r) => r.textContent.includes('New'));

        expect(row.querySelector('.hof-pill').textContent).toBe('Not indexed');
    });
});
