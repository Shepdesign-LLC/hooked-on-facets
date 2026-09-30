import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import HelpDrawer from '../../admin/src/components/HelpDrawer.jsx';
import App from '../../admin/src/App.jsx';
import {
    DOC_SECTIONS,
    DOCS_BASE,
    HELP_CONTEXT,
    countLinks,
    docUrl,
    filterDocs,
    helpContext,
} from '../../admin/src/lib/help.js';
import { VIEWS } from '../../admin/src/lib/views.js';

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

describe('help content', () => {
    it('links every doc under hookedonfacets.com/docs/<slug>/', () => {
        expect(docUrl('getting-started')).toBe('https://hookedonfacets.com/docs/getting-started/');
        for (const s of DOC_SECTIONS) {
            for (const l of s.links) expect(docUrl(l.slug)).toBe(`${DOCS_BASE}/${l.slug}/`);
        }
    });

    it('uses exactly the documented slugs', () => {
        const slugs = DOC_SECTIONS.flatMap((s) => s.links.map((l) => l.slug)).sort();

        expect(slugs).toEqual([
            'ask', 'blueprint', 'bricks', 'design-tokens', 'facet-types', 'getting-started', 'post-types', 'search', 'seo', 'sources', 'wp-cli',
        ]);
    });

    it('has Start here and Reference sections', () => {
        expect(DOC_SECTIONS.map((s) => s.title)).toEqual(['Start here', 'Reference']);
        expect(DOC_SECTIONS[0].links).toHaveLength(4);
        expect(DOC_SECTIONS[1].links).toHaveLength(7);
    });

    it('has copy for every screen plus the editor', () => {
        for (const v of VIEWS) expect(HELP_CONTEXT[v.id], v.id).toBeTruthy();
        expect(HELP_CONTEXT.editor).toBeTruthy();
    });

    it('treats the Facets screen as the editor while one is open', () => {
        expect(helpContext('facets', 'list').title).toBe('Facets list');
        expect(helpContext('facets', 'editor').title).toBe('Facet editor');
        expect(helpContext('indexer', 'editor').title).toBe('Indexer');
    });

    it('returns nothing for an unknown screen', () => {
        expect(helpContext('nope')).toEqual({ title: '', text: '' });
    });
});

describe('filterDocs', () => {
    it('returns everything for an empty query', () => {
        expect(countLinks(filterDocs(''))).toBe(11);
        expect(countLinks(filterDocs('   '))).toBe(11);
    });

    it('matches titles case-insensitively', () => {
        const out = filterDocs('BRICKS');

        expect(out).toHaveLength(1);
        expect(out[0].links.map((l) => l.slug)).toEqual(['bricks']);
    });

    it('needs every word to match', () => {
        expect(countLinks(filterDocs('facet types'))).toBe(1);
        expect(countLinks(filterDocs('bricks banana'))).toBe(0);
    });

    it('matches the kind tag and the slug', () => {
        expect(filterDocs('guide')[0].title).toBe('Start here');
        expect(countLinks(filterDocs('wp-cli'))).toBe(1);
    });

    it('drops sections with no matches', () => {
        expect(filterDocs('seo').map((s) => s.title)).toEqual(['Reference']);
    });
});

describe('HelpDrawer', () => {
    const drawer = (props = {}) =>
        createElement(HelpDrawer, { open: true, onClose: vi.fn(), view: 'facets', facetsScreen: 'list', proActive: true, ...props });
    const el = () => host.querySelector('.hof-drawer');
    const search = () => host.querySelector('input[type="search"]');
    const links = () => [...host.querySelectorAll('a.hof-drawer-doc')];

    it('is a labelled modal dialog', async () => {
        await mount(drawer());

        expect(el().getAttribute('role')).toBe('dialog');
        expect(el().getAttribute('aria-modal')).toBe('true');
        expect(el().getAttribute('aria-labelledby')).toBe(el().querySelector('h2').id);
        expect(el().querySelector('h2').textContent).toBe('Help');
    });

    it('opens with the search box focused', async () => {
        await mount(drawer());

        expect(document.activeElement).toBe(search());
    });

    it('lists the contents top to bottom: search, this screen, Start here, Reference, support', async () => {
        await mount(drawer());
        const order = [...el().children].map((c) =>
            c.matches('input') ? 'search'
                : c.classList.contains('hof-drawer-ctx') ? 'ctx'
                    : c.tagName === 'SECTION' ? c.getAttribute('aria-label')
                        : c.classList.contains('hof-drawer-ask') ? 'support' : null
        ).filter(Boolean);

        expect(order).toEqual(['search', 'ctx', 'Start here', 'Reference', 'support']);
    });

    it('describes the current screen', async () => {
        await mount(drawer({ view: 'indexer' }));

        expect(host.querySelector('.hof-drawer-ctx').textContent).toContain('On this screen');
        expect(host.querySelector('.hof-drawer-ctx').textContent).toContain('Reindex here if counts look wrong after a bulk import.');
    });

    it('changes the card when the screen changes', async () => {
        await mount(drawer({ view: 'seo' }));
        expect(host.querySelector('.hof-drawer-ctx').textContent).toContain('Canonical, noindex and title rules');

        await act(async () => { root.render(drawer({ view: 'tokens' })); });
        expect(host.querySelector('.hof-drawer-ctx').textContent).toContain('Change one, restyle everything.');
    });

    it('opens every link in a new tab without leaking the opener', async () => {
        await mount(drawer());

        expect(links()).toHaveLength(11);
        for (const a of host.querySelectorAll('.hof-drawer a')) {
            expect(a.getAttribute('target')).toBe('_blank');
            expect(a.getAttribute('rel')).toContain('noopener');
        }
        expect(links()[0].getAttribute('href')).toBe('https://hookedonfacets.com/docs/getting-started/');
    });

    it('filters the link list as you type and hides empty sections', async () => {
        await mount(drawer());
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;

        await act(async () => {
            set.call(search(), 'bricks');
            search().dispatchEvent(new Event('input', { bubbles: true }));
        });

        expect(links().map((a) => a.textContent)).toEqual(['Binding a Bricks query loopGuide']);
        expect(host.querySelectorAll('section')).toHaveLength(1);
        expect(host.querySelector('[role="status"]').textContent).toBe('1 result');
    });

    it('says so, and links to the docs, when nothing matches', async () => {
        await mount(drawer());
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;

        await act(async () => {
            set.call(search(), 'zzz');
            search().dispatchEvent(new Event('input', { bubbles: true }));
        });

        expect(links()).toHaveLength(0);
        expect(host.querySelector('.hof-drawer-none').textContent).toContain('Nothing matches “zzz”');
        expect(host.querySelector('.hof-drawer-none a').getAttribute('href')).toBe('https://hookedonfacets.com/docs/');
    });

    it('closes on Escape', async () => {
        const onClose = vi.fn();
        await mount(drawer({ onClose }));

        await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes from the close button and the scrim', async () => {
        const onClose = vi.fn();
        await mount(drawer({ onClose }));

        await act(async () => [...el().querySelectorAll('button')].find((b) => b.textContent === 'Close').click());
        await act(async () => host.querySelector('.hof-scrim').click());

        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('ignores Escape while closed', async () => {
        const onClose = vi.fn();
        await mount(drawer({ open: false, onClose }));

        await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });

        expect(onClose).not.toHaveBeenCalled();
    });

    it('is hidden from assistive tech until opened', async () => {
        await mount(drawer({ open: false }));

        expect(el().getAttribute('aria-hidden')).toBe('true');
        expect(el().classList.contains('is-open')).toBe(false);
        expect(host.querySelector('.hof-scrim').classList.contains('is-open')).toBe(false);

        await act(async () => { root.render(drawer({ open: true })); });
        expect(el().getAttribute('aria-hidden')).toBeNull();
        expect(el().classList.contains('is-open')).toBe(true);
    });

    it('keeps Tab inside the drawer', async () => {
        await mount(drawer());
        const focusables = [...el().querySelectorAll('a[href], button, input')];
        const last = focusables[focusables.length - 1];
        last.focus();

        const e = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        await act(async () => { document.dispatchEvent(e); });

        expect(e.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(focusables[0]);
    });

    it('wraps Shift+Tab from the first control to the last', async () => {
        await mount(drawer());
        const focusables = [...el().querySelectorAll('a[href], button, input')];
        focusables[0].focus();

        const e = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
        await act(async () => { document.dispatchEvent(e); });

        expect(document.activeElement).toBe(focusables[focusables.length - 1]);
    });

    it('returns focus to what opened it when it closes', async () => {
        const trigger = document.createElement('button');
        document.body.appendChild(trigger);
        trigger.focus();
        await mount(drawer({ open: false }));

        await act(async () => { root.render(drawer({ open: true })); });
        expect(document.activeElement).toBe(search());
        await act(async () => { root.render(drawer({ open: false })); });

        expect(document.activeElement).toBe(trigger);
        trigger.remove();
    });

    it('mentions Pro support only when Pro is active', async () => {
        await mount(drawer({ proActive: true }));
        expect(host.querySelector('.hof-drawer-ask').textContent).toContain('Pro customers get priority email support from the License screen.');

        await act(async () => { root.render(drawer({ proActive: false })); });
        expect(host.querySelector('.hof-drawer-ask').textContent).not.toContain('Pro customers');
        expect(host.querySelector('.hof-drawer-ask a').getAttribute('href')).toBe('https://github.com/Shepdesign/hooked-on-facets/issues');
    });
});

describe('Help in the app', () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}), text: async () => '' }));
    });

    const bootstrap = {
        proActive: true, version: '1.1.1', restUrl: '/wp-json/hof/v1/', nonce: 'x',
        facets: [{ name: 'brand', label: 'Brand', kind: 'taxonomy', source: 'pa_brand', display: 'checkbox', post_type: 'product', settings: {} }],
        telemetry: {}, tokens: {}, availableDisplays: ['checkbox'],
    };
    const rail = (label) => [...host.querySelectorAll('.hof-rail-item')].find((b) => b.textContent === label);
    const helpButton = () => host.querySelector('.hof-topbar .hof-btn-help');
    const isOpen = () => host.ownerDocument.querySelector('.hof-drawer.is-open') !== null;
    const esc = () => act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });

    it('has a coral-outlined Help button in the top right', async () => {
        await mount(createElement(App, { bootstrap }));

        expect(helpButton().textContent).toBe('Help');
        expect(helpButton().className).toContain('hof-btn-help');
        expect(host.querySelector('.hof-topbar-right').contains(helpButton())).toBe(true);
        expect(helpButton().getAttribute('aria-haspopup')).toBe('dialog');
    });

    it('mounts the drawer once', async () => {
        await mount(createElement(App, { bootstrap }));

        expect(host.querySelectorAll('.hof-drawer')).toHaveLength(1);
    });

    for (const view of VIEWS) {
        it(`opens on ${view.label} with the right text and Escape closes it`, async () => {
            await mount(createElement(App, { bootstrap }));
            await act(async () => rail(view.label).click());

            await act(async () => helpButton().click());
            expect(isOpen(), 'open').toBe(true);
            expect(host.querySelector('.hof-drawer-ctx').textContent).toContain(HELP_CONTEXT[view.id]);
            expect(document.activeElement.getAttribute('type')).toBe('search');
            expect(helpButton().getAttribute('aria-expanded')).toBe('true');

            await esc();
            expect(isOpen(), 'closed').toBe(false);
            expect(document.activeElement).toBe(helpButton());
        });
    }

    it('describes the facet editor when one is open', async () => {
        await mount(createElement(App, { bootstrap }));
        await act(async () => rail('Facets').click());
        await act(async () => host.querySelector('.hof-table-row').click());

        await act(async () => helpButton().click());

        expect(host.querySelector('.hof-drawer-ctx').textContent).toContain('Facet editor.');
        expect(host.querySelector('.hof-drawer-ctx').textContent).toContain('Source first, then type.');
    });

    it('closes from the scrim and the close button', async () => {
        await mount(createElement(App, { bootstrap }));

        await act(async () => helpButton().click());
        await act(async () => host.querySelector('.hof-scrim').click());
        expect(isOpen()).toBe(false);

        await act(async () => helpButton().click());
        await act(async () => [...host.querySelectorAll('.hof-drawer button')].find((b) => b.textContent === 'Close').click());
        expect(isOpen()).toBe(false);
    });
});
