import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import Shell from '../../admin/src/components/Shell.jsx';
import { SECTION_ORDER, VIEWS, availableViews } from '../../admin/src/lib/views.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let host;

function mount(props = {}) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const onNavigate = vi.fn();
    act(() => {
        root.render(createElement(Shell, {
            views: availableViews(true), view: 'facets', onNavigate, version: '1.1.1', proActive: true,
            stats: { background: { running: false } }, avgMs: 4.2, ...props,
        }, createElement('p', { className: 'screen' }, 'screen body')));
    });
    return onNavigate;
}

afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
});

const rail = () => host.querySelector('.hof-rail');
const items = () => [...host.querySelectorAll('.hof-rail-item')];

describe('the nine screens', () => {
    it('are all defined, none merged or renamed', () => {
        expect(VIEWS.map((v) => v.label)).toEqual([
            'Dashboard', 'Facets', 'Query loops', 'Indexer', 'Blueprint', 'Design tokens', 'SEO', 'License', 'Settings',
        ]);
    });

    it('sit in three groups: Main, Studio, System', () => {
        expect(SECTION_ORDER).toEqual(['Main', 'Studio', 'System']);
        const bySection = (s) => VIEWS.filter((v) => v.section === s).map((v) => v.label);

        expect(bySection('Main')).toEqual(['Dashboard', 'Facets', 'Query loops', 'Indexer']);
        expect(bySection('Studio')).toEqual(['Blueprint', 'Design tokens']);
        expect(bySection('System')).toEqual(['SEO', 'License', 'Settings']);
    });

    it('keeps License behind the Pro add-on, as before', () => {
        expect(availableViews(true)).toHaveLength(9);
        expect(availableViews(false).map((v) => v.id)).not.toContain('license');
        expect(availableViews(false)).toHaveLength(8);
    });
});

describe('Shell rail', () => {
    it('renders every screen in its group with a line icon', () => {
        mount();
        const groups = [...host.querySelectorAll('.hof-rail-group')];

        expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['Main', 'Studio', 'System']);
        expect(groups[0].querySelectorAll('.hof-rail-item')).toHaveLength(4);
        expect(groups[1].querySelectorAll('.hof-rail-item')).toHaveLength(2);
        expect(groups[2].querySelectorAll('.hof-rail-item')).toHaveLength(3);
        items().forEach((b) => expect(b.querySelector('svg'), b.textContent).toBeTruthy());
    });

    it('is one labelled nav', () => {
        mount();

        expect(rail().tagName).toBe('NAV');
        expect(rail().getAttribute('aria-label')).toBe('hooked on facets');
    });

    it('marks only the current screen with aria-current', () => {
        mount({ view: 'blueprint' });
        const current = items().filter((b) => b.getAttribute('aria-current') === 'page');

        expect(current.map((b) => b.textContent)).toEqual(['Blueprint']);
    });

    it('navigates on click', () => {
        const onNavigate = mount();
        const tokens = items().find((b) => b.textContent === 'Design tokens');

        act(() => tokens.click());

        expect(onNavigate).toHaveBeenCalledWith('tokens');
    });

    it('drops empty groups and the License item without Pro', () => {
        mount({ views: availableViews(false), proActive: false });

        expect(items().map((b) => b.textContent)).not.toContain('License');
        expect(items()).toHaveLength(8);
    });

    it('is a rail beside the content, which fills the rest of the frame', () => {
        mount();

        expect(host.querySelector('.hof-shell > .hof-rail')).toBeTruthy();
        expect(host.querySelector('.hof-shell > .hof-view .screen').textContent).toBe('screen body');
    });
});

describe('rail footer', () => {
    it('shows version, plan and index state', () => {
        mount();
        const foot = host.querySelector('.hof-rail-foot').textContent;

        expect(foot).toContain('v1.1.1');
        expect(foot).toContain('Pro');
        expect(foot).toContain('Index fresh · 4.2 ms');
    });

    it('says Free without the add-on', () => {
        mount({ proActive: false });

        expect(host.querySelector('.hof-rail-foot').textContent).toContain('Free');
    });

    it('shows progress while a rebuild runs', () => {
        mount({ stats: { background: { running: true, percent: 41.6 } } });

        expect(host.querySelector('.hof-rail-foot').textContent).toContain('Indexing 42%');
    });

    it('omits the timing when there is no sample yet', () => {
        mount({ avgMs: undefined });

        expect(host.querySelector('.hof-rail-foot').textContent).toContain('Index fresh');
        expect(host.querySelector('.hof-rail-foot').textContent).not.toContain(' ms');
    });
});

describe('top bar', () => {
    it('carries the lowercase name, the index pill and the plan pill', () => {
        mount();
        const bar = host.querySelector('.hof-topbar');

        expect(bar.querySelector('.hof-wordmark').textContent).toBe('hooked on facets');
        expect(bar.textContent).toContain('Index up to date');
        expect(bar.querySelector('.hof-pill-pro').textContent).toBe('Pro');
    });

    it('shows a neutral Free pill without the add-on', () => {
        mount({ proActive: false });
        const pills = [...host.querySelectorAll('.hof-topbar-right > .hof-pill')];

        expect(pills.find((p) => p.textContent === 'Free').classList.contains('hof-pill-pro')).toBe(false);
    });

    it('turns the index pill coral while indexing', () => {
        mount({ stats: { background: { running: true, percent: 10 } } });

        expect(host.querySelector('.hof-topbar .hof-pill-busy').textContent).toContain('Indexing 10%');
    });

    it('explains the index status in a tooltip', () => {
        mount();
        const tip = host.querySelector('.hof-topbar .hof-tip');

        expect(tip.dataset.tip).toContain('fast lookup table');
        expect(tip.getAttribute('tabindex')).toBe('0');
    });

    it('has a slot for actions (the Help button lands here)', () => {
        mount({ actions: createElement('button', { className: 'hof-btn hof-btn-help' }, 'Help') });

        expect(host.querySelector('.hof-topbar-right .hof-btn-help').textContent).toBe('Help');
    });

    it('labels the brand mark with the lowercase name', () => {
        mount();

        expect(host.querySelector('.hof-mark').getAttribute('aria-label')).toBe('hooked on facets');
    });
});
