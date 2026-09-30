import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

vi.mock('../../admin/src/api.js', () => ({ saveTokens: vi.fn() }));
// The suite runs with css: false, which blanks ?inline imports. Hand the
// component the real public stylesheet instead.
vi.mock('../../public/src/styles/facets.css?inline', async () => {
    const { readFileSync } = await import('node:fs');
    return { default: readFileSync('public/src/styles/facets.css', 'utf8') };
});

import { saveTokens } from '../../admin/src/api.js';
import DesignTokens from '../../admin/src/components/DesignTokens.jsx';
import { customCssFor, generatedCss, isHex, previewSafe, tokenBlock } from '../../admin/src/lib/tokens.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const BRAND = {
    '--hof-primary': '#534AB7',
    '--hof-on-primary': '#FFFFFF',
    '--hof-text': '#221D52',
    '--hof-radius-sm': '6px',
    '--hof-font-body': 'inherit',
};
const INITIAL = {
    tokens: { ...BRAND, '--hof-primary': '#5b6cff' },
    brand: BRAND,
    custom_css: '',
    scope: 'site',
    facet: '',
};
const FACETS = [
    { name: 'brand', label: 'Brand' },
    { name: 'color', label: 'Color' },
];

let root;
let host;
const mount = async (props = {}) => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
        root.render(createElement(DesignTokens, { initial: INITIAL, facets: FACETS, ...props }));
    });
};
const $ = (sel) => host.querySelector(sel);
const byText = (sel, text) => [...host.querySelectorAll(sel)].find((n) => n.textContent.trim() === text);
const type = async (el, value) => {
    const proto = { TEXTAREA: HTMLTextAreaElement, SELECT: HTMLSelectElement }[el.tagName] || HTMLInputElement;
    await act(async () => {
        Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, value);
        el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    });
};
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

afterEach(async () => {
    await act(async () => root?.unmount());
    host?.remove();
    vi.clearAllMocks();
});

describe('tokens lib', () => {
    it('prints tokens on the selector public facets read, never :root', () => {
        const css = tokenBlock({ '--hof-primary': '#111111' });
        expect(css).toBe('.hof-facet, .hof-results {\n    --hof-primary: #111111;\n}');
        expect(css).not.toMatch(/:root/);
    });

    it('skips empty values', () => {
        expect(tokenBlock({ '--a': ' ', '--b': '1px' })).toBe('.hof-facet, .hof-results {\n    --b: 1px;\n}');
    });

    it('scopes custom CSS to a facet only when asked', () => {
        const css = '.hof-btn{x:y}';
        expect(customCssFor({ customCss: css, scope: 'site', facet: 'brand' })).toBe(css);
        expect(customCssFor({ customCss: css, scope: 'facet', facet: 'brand' })).toBe('.hof-facet--brand .hof-btn{x:y}');
        expect(customCssFor({ customCss: css, scope: 'facet', facet: '' })).toBe(css);
        expect(customCssFor({ customCss: '  ', scope: 'facet', facet: 'brand' })).toBe('');
    });

    it('appends custom CSS after the token block', () => {
        const out = generatedCss({ tokens: { '--a': '1' }, customCss: '.x{y:z}', scope: 'site', facet: '' });
        expect(out.endsWith('\n\n.x{y:z}')).toBe(true);
    });

    it('recognises only 6-digit hex for the color picker', () => {
        expect(isHex('#5b6cff')).toBe(true);
        expect(isHex('#fff')).toBe(false);
        expect(isHex('var(--x)')).toBe(false);
    });

    it('drops @import from preview CSS', () => {
        expect(previewSafe('@import url("x.css"); .a{b:c}')).toBe(' .a{b:c}');
    });
});

describe('Design tokens screen', () => {
    it('lists every token with its saved value', async () => {
        await mount();
        expect($('#hof-tk-hof-primary').value).toBe('#5b6cff');
        expect($('#hof-tk-hof-radius-sm').value).toBe('6px');
        expect($('#hof-tk-hof-font-body').value).toBe('inherit');
    });

    it('keeps Save disabled until something changes', async () => {
        await mount();
        expect(byText('button', 'Save tokens').disabled).toBe(true);
        await type($('#hof-tk-hof-primary'), '#123456');
        expect(byText('button', 'Save tokens').disabled).toBe(false);
    });

    it('shows the generated CSS and updates it as a token changes', async () => {
        await mount();
        await type($('#hof-tk-hof-primary'), '#123456');
        expect($('[data-testid=tokens-css]').textContent).toContain('--hof-primary: #123456;');
    });

    it('renders the preview in a shadow root, with the real public CSS and the token override', async () => {
        await mount();
        await type($('#hof-tk-hof-primary'), '#123456');
        const shadow = $('[data-testid=tokens-preview]').shadowRoot;
        expect(shadow).toBeTruthy();
        expect(shadow.querySelector('.hof-btn--empty').disabled).toBe(true);
        expect(shadow.querySelectorAll('.hof-btn')).toHaveLength(3);
        const css = shadow.querySelector('style').textContent;
        expect(css).toContain('--hof-primary: #123456;');
        expect(css).toContain('.hof-btn--pill'); // the real public stylesheet, not a copy
        // The admin's own .hof-btn is not touched by the public styles.
        expect(host.querySelector('.hof-tk-shadow .hof-btn')).toBeNull();
    });

    it('runs custom CSS in the preview, after the tokens', async () => {
        await mount();
        await type($('textarea'), '.hof-btn { text-transform: uppercase; }');
        const css = $('[data-testid=tokens-preview]').shadowRoot.querySelector('style').textContent;
        expect(css.indexOf('--hof-primary')).toBeLessThan(css.indexOf('text-transform: uppercase'));
    });

    it('scopes custom CSS to the chosen facet and gives the preview that class', async () => {
        await mount();
        await type($('textarea'), '.hof-btn { color: red; }');
        await click(byText('button', 'This facet'));
        await type($('#hof-tk-facet'), 'color');
        const shadow = $('[data-testid=tokens-preview]').shadowRoot;
        expect(shadow.querySelector('.hof-facet--color')).toBeTruthy();
        expect(shadow.querySelector('style').textContent).toContain('.hof-facet--color .hof-btn { color: red; }');
        expect($('[data-testid=tokens-css]').textContent).toContain('.hof-facet--color .hof-btn');
    });

    it('preselects the first facet when switching to facet scope', async () => {
        await mount();
        await click(byText('button', 'This facet'));
        expect($('#hof-tk-facet').value).toBe('brand');
    });

    it('resets tokens to brand without saving', async () => {
        await mount();
        await click(byText('button', 'Reset to brand'));
        expect($('#hof-tk-hof-primary').value).toBe('#534AB7');
        expect(saveTokens).not.toHaveBeenCalled();
        expect(byText('button', 'Save tokens').disabled).toBe(false);
    });

    it('saves tokens, css, scope and facet, then goes clean', async () => {
        saveTokens.mockResolvedValue({ ...INITIAL, tokens: { ...INITIAL.tokens, '--hof-primary': '#123456' }, custom_css: '.a{b:c}', scope: 'facet', facet: 'brand' });
        await mount();
        await type($('#hof-tk-hof-primary'), '#123456');
        await type($('textarea'), '.a{b:c}');
        await click(byText('button', 'This facet'));
        await click(byText('button', 'Save tokens'));
        expect(saveTokens).toHaveBeenCalledWith({
            tokens: expect.objectContaining({ '--hof-primary': '#123456' }),
            custom_css: '.a{b:c}',
            scope: 'facet',
            facet: 'brand',
        });
        expect(byText('button', 'Save tokens').disabled).toBe(true);
        expect($('[role=status]').textContent).toContain('Saved');
    });

    it('says so when saving fails and stays dirty', async () => {
        saveTokens.mockRejectedValue(new Error('403 Forbidden'));
        await mount();
        await type($('#hof-tk-hof-primary'), '#123456');
        await click(byText('button', 'Save tokens'));
        expect($('[role=status]').textContent).toContain('403 Forbidden');
        expect(byText('button', 'Save tokens').disabled).toBe(false);
    });

    it('copies the generated CSS', async () => {
        const writeText = vi.fn().mockResolvedValue();
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        await mount();
        await click(byText('button', 'Copy CSS'));
        expect(writeText).toHaveBeenCalledWith($('[data-testid=tokens-css]').textContent);
        expect($('[role=status]').textContent).toContain('copied');
    });

    it('links the class reference and names the public filter', async () => {
        await mount();
        expect($('a[href="https://hookedonfacets.com/docs/design-tokens/"]').textContent).toBe('Class reference');
        expect($('.hof-lede').textContent).toContain('hof_public_css_tokens');
    });
});
