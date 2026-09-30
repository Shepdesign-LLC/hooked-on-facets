import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

vi.mock('../../admin/src/api.js', () => ({
    getPostTypes: vi.fn(),
    savePostTypes: vi.fn(),
}));

import { getPostTypes, savePostTypes } from '../../admin/src/api.js';
import Settings from '../../admin/src/components/Settings.jsx';
import AiSettings, { PROVIDERS } from '../../admin/src/components/AiSettings.jsx';

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

const ROWS = [
    { slug: 'product', label: 'Products', items: 1200, indexed: true, custom: false, woocommerce: true },
    { slug: 'guide', label: 'Trail guides', items: 84, indexed: true, custom: true, woocommerce: false },
    { slug: 'post', label: 'Posts', items: 312, indexed: true, custom: false, woocommerce: false },
    { slug: 'page', label: 'Pages', items: 14, indexed: false, custom: false, woocommerce: false },
    { slug: 'dealer', label: 'Dealers', items: 0, indexed: false, custom: true, woocommerce: false },
];

const bootstrap = (over = {}) => ({
    proActive: true, restUrl: '/r/', nonce: 'x',
    woocommerceActive: true, acfActive: true, metaboxActive: false, podsActive: false, ...over,
});

const tab = (label) => [...host.querySelectorAll('[role="tab"]')].find((t) => t.textContent === label);
const panel = () => host.querySelector('[role="tabpanel"]');
const flush = () => act(async () => {});

beforeEach(() => {
    getPostTypes.mockReset();
    savePostTypes.mockReset();
    getPostTypes.mockResolvedValue({ post_types: ROWS, managed_by_filter: false });
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ configured: false, fingerprint: '', model: '' }) }));
});

describe('Settings tabs', () => {
    it('has the title, lede and three tabs: Ask, Sources, Post types', async () => {
        await mount(createElement(Settings, { bootstrap: bootstrap() }));

        expect(host.querySelector('.hof-view-title').textContent).toBe('Settings');
        expect(host.querySelector('.hof-lede').textContent).toContain('Nothing here is needed to make your first facet.');
        expect([...host.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual(['Ask', 'Sources', 'Post types']);
    });

    it('is a proper tablist with one selected, focusable tab', async () => {
        await mount(createElement(Settings, { bootstrap: bootstrap() }));
        const tabs = [...host.querySelectorAll('[role="tab"]')];

        expect(host.querySelector('[role="tablist"]').getAttribute('aria-label')).toBe('Settings');
        expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
        expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
        expect(panel().getAttribute('aria-labelledby')).toBe(tabs[0].id);
        expect(tabs[0].getAttribute('aria-controls')).toBe(panel().id);
    });

    it('starts on Ask', async () => {
        await mount(createElement(Settings, { bootstrap: bootstrap() }));
        await flush();

        expect(panel().textContent).toContain('Powers the conversational');
    });

    it('switches panels on click', async () => {
        await mount(createElement(Settings, { bootstrap: bootstrap() }));

        await act(async () => tab('Sources').click());
        expect(tab('Sources').getAttribute('aria-selected')).toBe('true');
        expect(panel().textContent).toContain('WooCommerce');

        await act(async () => tab('Post types').click());
        await flush();
        expect(panel().textContent).toContain('Products');
    });

    it('moves between tabs with the arrow keys, wrapping', async () => {
        await mount(createElement(Settings, { bootstrap: bootstrap() }));
        tab('Ask').focus();
        const key = (k) => act(async () => { document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); });

        await key('ArrowRight');
        expect(tab('Sources').getAttribute('aria-selected')).toBe('true');
        expect(document.activeElement).toBe(tab('Sources'));

        await key('End');
        expect(tab('Post types').getAttribute('aria-selected')).toBe('true');
        await key('ArrowRight');
        expect(tab('Ask').getAttribute('aria-selected')).toBe('true');
        await key('ArrowLeft');
        expect(tab('Post types').getAttribute('aria-selected')).toBe('true');
        await key('Home');
        expect(tab('Ask').getAttribute('aria-selected')).toBe('true');
    });

    it('shows the Pro upsell in the Ask tab without the add-on', async () => {
        await mount(createElement(Settings, { bootstrap: bootstrap({ proActive: false }) }));

        expect(panel().textContent).toContain('AI settings (the Ask facet) are part of HOF Pro');
        expect(host.querySelector('#hof-ai-provider')).toBeNull();
    });
});

describe('Sources tab', () => {
    it('shows each source as Connected or Off', async () => {
        await mount(createElement(Settings, { bootstrap: bootstrap() }));
        await act(async () => tab('Sources').click());
        const rows = [...host.querySelectorAll('.hof-setting-row')].map((r) => r.textContent);

        expect(rows).toEqual([
            'WooCommerceCategories, attributes, price, stockConnected',
            'ACFAdvanced Custom FieldsConnected',
            'Meta BoxNot installedOff',
            'PodsNot installedOff',
        ]);
        expect(host.querySelectorAll('.hof-pill-good')).toHaveLength(2);
    });
});

describe('Post types tab', () => {
    const open = async (props = {}) => {
        await mount(createElement(Settings, { bootstrap: bootstrap(), ...props }));
        await act(async () => tab('Post types').click());
        await flush();
    };
    const row = (label) => [...host.querySelectorAll('.hof-setting-row')].find((r) => r.textContent.startsWith(label));
    const sw = (label) => row(label).querySelector('[role="switch"]');

    it('lists every post type with its count and description', async () => {
        await open();

        expect([...host.querySelectorAll('.hof-setting-row')].map((r) => r.querySelector('span').textContent)).toEqual([
            'Products1,200 items · WooCommerce',
            'Trail guides84 items · custom post type',
            'Posts312 items',
            'Pages14 items',
            'Dealers0 items · custom post type',
        ]);
    });

    it('shows the index toggle state for each', async () => {
        await open();

        expect(['Products', 'Trail guides', 'Posts', 'Pages', 'Dealers'].map((l) => sw(l).getAttribute('aria-checked')))
            .toEqual(['true', 'true', 'true', 'false', 'false']);
        expect(sw('Products').getAttribute('aria-label')).toBe('Index products');
    });

    it('turning one on sends the full list and says it is indexing in the background', async () => {
        savePostTypes.mockResolvedValue({
            post_types: ROWS.map((r) => (r.slug === 'dealer' ? { ...r, indexed: true } : r)), managed_by_filter: false, queued: 'background', added: ['dealer'], removed: [],
        });
        const onPostTypesChanged = vi.fn();
        await open({ onPostTypesChanged });

        await act(async () => sw('Dealers').click());

        expect(savePostTypes).toHaveBeenCalledWith(['product', 'guide', 'post', 'dealer']);
        expect(host.querySelector('[role="status"]').textContent).toContain('Indexing Dealers in the background.');
        expect(host.querySelector('[role="status"]').textContent).toContain('under Applies to');
        expect(sw('Dealers').getAttribute('aria-checked')).toBe('true');
        expect(onPostTypesChanged).toHaveBeenCalled();
    });

    it('turning one off sends the list without it', async () => {
        savePostTypes.mockResolvedValue({
            post_types: ROWS.map((r) => (r.slug === 'post' ? { ...r, indexed: false } : r)), managed_by_filter: false, queued: 'none', added: [], removed: ['post'],
        });
        await open();

        await act(async () => sw('Posts').click());

        expect(savePostTypes).toHaveBeenCalledWith(['product', 'guide']);
        expect(host.querySelector('[role="status"]').textContent).toContain('Posts is off and removed from the index.');
    });

    it('points at the Indexer when no scheduler is available', async () => {
        savePostTypes.mockResolvedValue({ post_types: ROWS, managed_by_filter: false, queued: 'manual', added: ['dealer'], removed: [] });
        await open();

        await act(async () => sw('Dealers').click());

        expect(host.querySelector('[role="status"]').textContent).toContain('run a reindex from the Indexer');
    });

    it('shows the reason and leaves the toggle alone when the server refuses', async () => {
        savePostTypes.mockRejectedValue(new Error('409 Conflict — A rebuild is already running. Try again when it finishes.'));
        await open();

        await act(async () => sw('Dealers').click());

        expect(host.querySelector('[role="alert"]').textContent).toContain('A rebuild is already running');
        expect(sw('Dealers').getAttribute('aria-checked')).toBe('false');
    });

    it('disables the toggles while saving', async () => {
        let resolve;
        savePostTypes.mockImplementation(() => new Promise((r) => { resolve = r; }));
        await open();

        await act(async () => sw('Dealers').click());
        expect([...host.querySelectorAll('[role="switch"]')].every((s) => s.disabled)).toBe(true);

        await act(async () => resolve({ post_types: ROWS, managed_by_filter: false, queued: 'none', added: [], removed: [] }));
        expect([...host.querySelectorAll('[role="switch"]')].some((s) => s.disabled)).toBe(false);
    });

    it('explains what turning one on does', async () => {
        await open();

        expect(host.textContent).toContain('Turning a post type on indexes it in the background and makes it available under Applies to in the facet editor.');
    });

    it('says when a developer filter is changing the list', async () => {
        getPostTypes.mockResolvedValue({ post_types: ROWS, managed_by_filter: true });
        await open();

        expect(host.querySelector('[role="note"]').textContent).toContain('hof_indexed_post_types');
    });

    it('shows a load error', async () => {
        getPostTypes.mockRejectedValue(new Error('500 nope'));
        await open();

        expect(host.querySelector('[role="alert"]').textContent).toContain('500 nope');
    });
});

describe('Ask provider', () => {
    const load = async (config) => {
        globalThis.fetch = vi.fn(async (url, opts) => ({
            ok: true,
            json: async () => (opts?.method === 'POST' ? { ...config, ...JSON.parse(opts.body) } : config),
        }));
        await mount(createElement(AiSettings, { bootstrap: bootstrap() }));
        await flush();
    };
    const select = () => host.querySelector('#hof-ai-provider');

    it('offers Anthropic (recommended), OpenAI, Google and OpenRouter', async () => {
        await load({ configured: false });

        expect([...select().options].map((o) => o.textContent.split(' · ')[0])).toEqual(['Anthropic (recommended)', 'OpenAI', 'Google', 'OpenRouter']);
        expect(PROVIDERS.map((p) => p.id)).toEqual(['anthropic', 'openai', 'google', 'openrouter']);
        expect(select().value).toBe('anthropic');
    });

    it('only lets you pick providers the installed version supports', async () => {
        await load({ configured: false });

        expect([...select().options].map((o) => o.disabled)).toEqual([false, true, true, true]);
        expect(select().options[1].textContent).toContain('not available in this version');
    });

    it('enables the providers the server reports', async () => {
        await load({ configured: false, providers: ['anthropic', 'openai'] });

        expect([...select().options].map((o) => o.disabled)).toEqual([false, false, true, true]);
    });

    it('explains the provider choice in a tooltip', async () => {
        await load({ configured: false });
        const tip = host.querySelector('label[for="hof-ai-provider"] .hof-tip');

        expect(tip.dataset.tip).toContain('Anthropic is the default because prompt caching keeps each turn cheap');
    });

    it('saves a provider change on its own, without touching the key', async () => {
        await load({ configured: true, fingerprint: 'sk-ant…', providers: ['anthropic', 'openai'], provider: 'anthropic' });

        await act(async () => {
            select().value = 'openai';
            select().dispatchEvent(new Event('change', { bubbles: true }));
        });

        const post = globalThis.fetch.mock.calls.find(([, o]) => o?.method === 'POST');
        expect(JSON.parse(post[1].body)).toEqual({ provider: 'openai' });
        expect(select().value).toBe('openai');
    });

    it('still sends the key with Save key, and clears with an empty one', async () => {
        await load({ configured: true, fingerprint: 'x', provider: 'anthropic' });
        const input = host.querySelector('#hof-ai-key');
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        await act(async () => { set.call(input, 'sk-new'); input.dispatchEvent(new Event('input', { bubbles: true })); });

        await act(async () => [...host.querySelectorAll('button')].find((b) => b.textContent === 'Save key').click());
        await act(async () => [...host.querySelectorAll('button')].find((b) => b.textContent === 'Clear key').click());

        const bodies = globalThis.fetch.mock.calls.filter(([, o]) => o?.method === 'POST').map(([, o]) => JSON.parse(o.body));
        expect(bodies).toEqual([{ api_key: 'sk-new' }, { api_key: '' }]);
    });
});
