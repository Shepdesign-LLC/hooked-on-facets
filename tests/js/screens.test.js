import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('../../admin/src/api.js', () => ({
    getTelemetry: vi.fn(),
    resetTelemetry: vi.fn(),
    reindex: vi.fn(),
    applyFilter: vi.fn(async () => ({ total: 1200 })),
}));

import { getTelemetry, reindex } from '../../admin/src/api.js';
import Dashboard from '../../admin/src/components/Dashboard.jsx';
import QueryLoops from '../../admin/src/components/QueryLoops.jsx';
import Indexer from '../../admin/src/components/Indexer.jsx';
import Blueprint from '../../admin/src/components/Blueprint.jsx';
import SeoSettings from '../../admin/src/components/SeoSettings.jsx';
import { ago, duration, fmt } from '../../admin/src/lib/format.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let host;
const mount = async (el) => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root.render(el); });
};

afterEach(async () => {
    await act(async () => root?.unmount());
    host?.remove();
    vi.restoreAllMocks();
});

const tips = () => [...host.querySelectorAll('.hof-tip')].map((t) => t.dataset.tip);
const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../admin/src/styles/admin.css'), 'utf8');

describe('formatters', () => {
    it('formats numbers with thousands separators', () => {
        expect(fmt(14206)).toBe('14,206');
        expect(fmt(undefined)).toBe('—');
        expect(fmt(NaN)).toBe('—');
    });

    it('says how long ago', () => {
        expect(ago(1000, 1002)).toBe('just now');
        expect(ago(1000, 1030)).toBe('30s ago');
        expect(ago(1000, 1000 + 5 * 60)).toBe('5m ago');
        expect(ago(1000, 1000 + 2 * 3600)).toBe('2h ago');
        expect(ago(1000, 1000 + 3 * 86400)).toBe('3d ago');
        expect(ago(1000, 1000 + 65 * 86400)).toBe('2mo ago');
    });

    it('formats a duration', () => {
        expect(duration(19.4)).toBe('19.4 s');
        expect(duration(125)).toBe('2 min 5 s');
        expect(duration(-1)).toBe('');
    });
});

describe('Dashboard', () => {
    const telemetry = {
        loops: { count: 3, total_hits: 2418 },
        resolver: { avg_ms: 4.2, sample_size: 200 },
        facets: { usage: [{ facet: 'category', count: 2140 }], top_values: {}, zero_results: [{ signature: 'a', count: 41 }], total: 1 },
    };
    const props = { facets: [], productsIndexed: 1596, telemetry, onCreateFacet: vi.fn(), onOpenBlueprint: vi.fn() };

    it('explains Filter speed', async () => {
        await mount(createElement(Dashboard, props));
        const stat = [...host.querySelectorAll('.hof-stat')].find((s) => s.textContent.startsWith('Filter speed'));

        expect(stat.querySelector('.hof-tip').dataset.tip).toContain('Under 50 ms means a filter change feels instant.');
    });

    it('explains Filters that find nothing', async () => {
        await mount(createElement(Dashboard, props));
        const card = [...host.querySelectorAll('.hof-analytics-card')].find((c) => c.textContent.includes('Filters that find nothing'));

        expect(card.querySelector('.hof-tip').dataset.tip).toContain('Combinations shoppers tried that returned zero results');
    });

    it('makes the tips keyboard-reachable', async () => {
        await mount(createElement(Dashboard, props));

        for (const t of host.querySelectorAll('.hof-tip')) expect(t.getAttribute('tabindex')).toBe('0');
    });

    it('leads with the next step, not engine jargon', async () => {
        await mount(createElement(Dashboard, { ...props, telemetry: {} }));

        expect(host.querySelector('.hof-dash-headline').textContent).toBe('Add a facet and it shows up on your store.');
        expect(host.querySelector('.hof-dash-hero .hof-btn-primary').textContent).toBe('New facet');
        expect(host.textContent).not.toMatch(/Auto-Hook Engine/);
    });

    it('hides latency percentiles it has no numbers for', async () => {
        await mount(createElement(Dashboard, { ...props, telemetry: { resolver: { p95_ms: 12.5 } } }));
        const labels = [...host.querySelectorAll('.hof-stat .hof-eyebrow')].map((e) => e.textContent);

        expect(labels).toContain('Slow (p95)');
        expect(labels).not.toContain('Typical (p50)');
        expect(labels).not.toContain('Slowest (p99)');
    });

    it('flags unused facets only once shoppers have used something', async () => {
        const facets = [{ name: 'brand', label: 'Brand', source: 'tax/brand', display: 'checkbox' }];
        await mount(createElement(Dashboard, { ...props, facets, telemetry: {} }));
        expect(host.querySelector('.hof-analytics-dead')).toBeNull();

        await act(async () => root.unmount());
        host.remove();
        await mount(createElement(Dashboard, { ...props, facets }));
        expect(host.querySelector('.hof-analytics-dead').textContent).toContain('1 facet not used yet: Brand');
    });

    it('marks each facet Live or Draft in words, not just a dot', async () => {
        const facets = [
            { name: 'brand', label: 'Brand', source: 'tax/brand', display: 'checkbox' },
            { name: 'wip', label: 'Wip', source: '', display: 'checkbox' },
        ];
        await mount(createElement(Dashboard, { ...props, facets }));
        const pills = [...host.querySelectorAll('.hof-dash-facet .hof-pill')].map((p) => p.textContent);

        expect(pills).toEqual(['Live', 'Draft']);
    });

    it('sets numbers in tabular figures', () => {
        expect(css).toMatch(/\.hof-dash,[\s\S]*?\{[^}]*font-variant-numeric: tabular-nums/);
        expect(css).toMatch(/\.hof-stat-value \{[^}]*font-variant-numeric: tabular-nums/);
    });
});

describe('Query loops', () => {
    const telemetry = {
        loops: {
            count: 3, total_hits: 2418,
            signatures: [
                { signature: 'archive:product', type: 'archive', post_type: 'product', count: 1904, first: 1, last: Math.floor(Date.now() / 1000) - 7200 },
                { signature: 'bricks:guide', type: 'bricks', post_type: 'guide', count: 402, first: 1, last: 1 },
                { signature: 'weird:x', type: 'weird', post_type: 'x', count: 1, first: 1, last: 0 },
            ],
        },
        resolver: { avg_ms: 3.8 },
    };

    beforeEach(() => getTelemetry.mockResolvedValue(telemetry));

    it('lists loops in a table with an Intercept column', async () => {
        await mount(createElement(QueryLoops));
        const heads = [...host.querySelectorAll('thead th')].map((th) => th.textContent.replace(/\?$/, ''));

        expect(heads).toEqual(['Loop', 'Intercept', 'Post type', 'Last seen', 'Hits']);
        expect(host.querySelectorAll('tbody tr')).toHaveLength(3);
    });

    it('explains the intercept types in a tooltip on that column', async () => {
        await mount(createElement(QueryLoops));
        const tip = host.querySelector('thead .hof-tip').dataset.tip;

        for (const phrase of ['Main query', 'Bricks class', 'Elementor', 'Query ID hof', 'Gutenberg']) {
            expect(tip, phrase).toContain(phrase);
        }
    });

    it('names each intercept type, including the page builders', async () => {
        await mount(createElement(QueryLoops));
        const chips = [...host.querySelectorAll('tbody .hof-chip')].map((c) => c.textContent);

        expect(chips).toEqual(['Post type archive', 'Bricks class: hof', 'Unknown']);
    });

    it('shows hits with thousands separators and a relative last-seen', async () => {
        await mount(createElement(QueryLoops));
        const first = host.querySelector('tbody tr');

        expect(first.querySelector('.hof-num').textContent).toBe('1,904');
        expect(first.textContent).toContain('2h ago');
    });
});

describe('Indexer', () => {
    const facets = [
        { name: 'brand', label: 'Brand', display: 'checkbox', kind: 'taxonomy', source: 'pa_brand' },
        { name: 'color', label: 'Color', display: 'swatch', kind: 'taxonomy', source: 'pa_color' },
        { name: 'q', label: 'Site search', display: 'search', kind: 'field', source: 'post_title' },
        { name: 'unsaved', label: 'Unsaved', display: 'checkbox', kind: 'taxonomy', source: 'x' },
    ];
    const stats = (over = {}) => ({
        post_types: [{ slug: 'product', label: 'Products', items: 1200 }, { slug: 'guide', label: 'Trail guides', items: 84 }, { slug: 'post', label: 'Posts', items: 312 }],
        registered_post_types: 5,
        totals: { rows: 14206, objects: 1596 },
        facets: {
            brand: { values: 8, rows: 1200, objects: 1200, post_type: 'product', status: 'indexed' },
            color: { values: 8, rows: 2840, objects: 1160, post_type: 'product', status: 'indexed' },
            q: { values: 0, rows: 5188, objects: 1596, post_type: '', status: 'indexed' },
        },
        background: { running: false, finished_at: Math.floor(Date.now() / 1000) - 7200, started_at: Math.floor(Date.now() / 1000) - 7200 - 19.4 },
        ...over,
    });
    const props = (over = {}) => ({ facets, stats: stats(), onRefresh: vi.fn(), ...over });

    it('shows index totals and the post types stat as "3 of 5"', async () => {
        await mount(createElement(Indexer, props()));
        const stat = (label) => [...host.querySelectorAll('.hof-stat')].find((s) => s.textContent.startsWith(label)).textContent;

        expect(stat('Index rows')).toContain('14,206');
        expect(stat('Distinct objects')).toContain('1,596');
        expect(stat('Facets in index')).toContain('3');
        expect(stat('Post types')).toBe('Post types3 of 5');
    });

    it('lists each facet with post type, rows, objects and a Fresh pill', async () => {
        await mount(createElement(Indexer, props()));
        const rows = [...host.querySelectorAll('tbody tr')].map((r) => [...r.children].map((c) => c.textContent));

        expect(rows[0]).toEqual(['Brand', 'Products', '1,200', '1,200', 'Fresh']);
        expect(rows[1]).toEqual(['Color', 'Products', '2,840', '1,160', 'Fresh']);
        expect(rows[2][1]).toBe('All');
        expect(host.querySelector('tbody .hof-pill-good').textContent).toBe('Fresh');
    });

    it('leaves out a facet the index has never seen', async () => {
        await mount(createElement(Indexer, props()));

        expect(host.textContent).not.toContain('Unsaved');
    });

    it('shows Indexing N% on every facet while a rebuild runs', async () => {
        await mount(createElement(Indexer, props({
            stats: stats({
                background: { running: true, percent: 96 },
                facets: {
                    brand: { values: 8, rows: 1200, objects: 1200, post_type: 'product', status: 'indexing' },
                    color: { values: 8, rows: 2840, objects: 1160, post_type: 'product', status: 'indexing' },
                },
            }),
        })));
        const pills = [...host.querySelectorAll('tbody .hof-pill')].map((p) => p.textContent);

        expect(pills).toEqual(['Indexing 96%', 'Indexing 96%']);
        expect(host.querySelector('tbody .hof-pill-busy')).toBeTruthy();
    });

    it('says Not indexed for a facet with no rows yet', async () => {
        await mount(createElement(Indexer, props({
            stats: stats({ facets: { brand: { values: 0, rows: 0, objects: 0, post_type: 'product', status: 'pending' } } }),
        })));

        expect(host.querySelector('tbody .hof-pill').textContent).toBe('Not indexed');
        expect(host.querySelector('tbody .hof-num').textContent).toBe('—');
    });

    it('puts the WP-CLI hint under the table', async () => {
        await mount(createElement(Indexer, props()));
        const note = host.querySelector('.hof-note');

        expect(note.textContent).toBe('WP-CLI: wp hof reindex for everything, wp hof reindex --post=123 for one item.');
        expect(host.querySelector('.hof-table-wrap').nextElementSibling).toBe(note);
    });

    it('shows when the last full rebuild finished and how long it took', async () => {
        await mount(createElement(Indexer, props()));

        expect(host.querySelector('.hof-view-actions .hof-pill-good').textContent).toBe('Last full rebuild 2h ago · 19.4 s');
    });

    it('shows progress in the header while rebuilding, and disables the button', async () => {
        await mount(createElement(Indexer, props({ stats: stats({ background: { running: true, percent: 40 } }) })));

        expect(host.querySelector('.hof-view-actions .hof-pill-busy').textContent).toBe('Rebuilding · 40%');
        const button = host.querySelector('.hof-btn-primary');
        expect(button.disabled).toBe(true);
        expect(button.textContent).toBe('Rebuilding…');
    });

    it('queues a background job and refreshes stats', async () => {
        reindex.mockResolvedValue({ mode: 'background', job: { job_id: 'x' } });
        const onRefresh = vi.fn();
        await mount(createElement(Indexer, props({ onRefresh })));

        await act(async () => host.querySelector('.hof-btn-primary').click());

        expect(host.querySelector('[role="status"]').textContent).toContain('Background job queued');
        expect(onRefresh).toHaveBeenCalled();
    });

    it('reports a synchronous rebuild without crashing on a missing field', async () => {
        reindex.mockResolvedValue({ mode: 'sync', indexed: 1596, elapsed: 19.4 });
        await mount(createElement(Indexer, props()));

        await act(async () => host.querySelector('.hof-btn-primary').click());

        expect(host.querySelector('[role="status"]').textContent).toBe('Reindexed 1,596 objects in 19.4 s.');
    });

    it('shows the error when the request fails', async () => {
        reindex.mockRejectedValue(new Error('500 nope'));
        await mount(createElement(Indexer, props()));

        await act(async () => host.querySelector('.hof-btn-primary').click());

        expect(host.querySelector('[role="alert"]').textContent).toContain('500 nope');
    });

    it('shows a loading state before stats arrive', async () => {
        await mount(createElement(Indexer, { facets, stats: null }));

        expect(host.textContent).toContain('Loading index stats…');
    });
});

describe('Blueprint', () => {
    const props = { facets: [{ name: 'color', label: 'Color', display: 'swiper', kind: 'taxonomy', source: 'pa_color', settings: {} }], onBack: vi.fn(), onSaveSettings: vi.fn() };

    it('calls the button Publish all', async () => {
        await mount(createElement(Blueprint, props));

        expect(host.querySelector('.hof-bp-deploy').textContent).toBe('Publish all');
    });

    it('explains Save versus Publish in a tooltip beside it', async () => {
        await mount(createElement(Blueprint, props));
        const tip = host.querySelector('.hof-bp-bar-actions .hof-tip').dataset.tip;

        expect(tip).toContain("Save to facet writes this facet's look back to that one facet");
        expect(tip).toContain('Publish all writes every facet in the playground to the Shop archive template');
        expect(host.querySelector('.hof-bp-bar-actions .hof-tip').getAttribute('tabindex')).toBe('0');
    });

    it('says the same in one sentence under the title', async () => {
        await mount(createElement(Blueprint, props));

        expect(host.querySelector('.hof-view-title').textContent).toBe('Playground');
        expect(host.querySelector('.hof-lede').textContent).toContain('Save one facet, or publish them all to the template.');
    });

    it('keeps the Sync behavior', async () => {
        await mount(createElement(Blueprint, props));

        expect(host.querySelector('.hof-bp-sync')).toBeTruthy();
    });
});

describe('SEO', () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn(async () => ({
            ok: true,
            json: async () => ({ settings: { manage_canonical: true, noindex_combos: true, noindex_threshold: 2, title_suffix: true }, pretty_urls: null }),
        }));
    });

    it('explains Canonical and the Noindex threshold, and nothing else', async () => {
        await mount(createElement(SeoSettings, { bootstrap: { restUrl: '/r/', nonce: 'x' } }));
        await act(async () => {});
        const texts = tips();

        expect(texts).toHaveLength(2);
        expect(texts[0]).toContain('A canonical tag tells Google which URL is the real one.');
        expect(texts[1]).toContain('How many facets have to be active before the page is marked noindex.');
    });
});
