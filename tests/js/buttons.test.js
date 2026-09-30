import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BUTTON_SELECTOR, patchButtons, pressButton } from '../../public/src/buttons.js';
import { Store, buildUrl } from '../../public/src/state.js';

// The exact markup src/Facets/Renderer.php emits for a button-style facet.
function facet({ display = 'checkbox', buttons, name = 'brand' }) {
    const html = buttons.map(({ value, label = value, count = 1, pressed = false, empty = false }) => `
        <button type="button"
                class="hof-btn hof-btn--pill hof-btn--outline${empty ? ' hof-btn--empty' : ''}"
                data-value="${value}"
                aria-pressed="${pressed}"
                ${empty ? 'disabled' : ''}>${label}<span class="hof-btn__count" data-hof-count="${value}">${count}</span></button>
    `).join('');

    const el = document.createElement('div');
    el.className = `hof-facet hof-facet-${display}`;
    el.setAttribute('data-hof-facet', name);
    el.setAttribute('data-hof-display', display);
    el.setAttribute('data-hof-style', 'buttons');
    el.innerHTML = `<fieldset><div class="hof-facet__buttons">${html}</div></fieldset>`;
    document.body.appendChild(el);
    return el;
}

const btn = (root, value) => root.querySelector(`[data-value="${value}"]`);
const pressedValues = (root) =>
    Array.from(root.querySelectorAll(BUTTON_SELECTOR)).filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.value);

afterEach(() => {
    document.body.innerHTML = '';
});

describe('pressButton — checkbox', () => {
    it('toggles a value on and reports the values', () => {
        const el = facet({ buttons: [{ value: 'alder' }, { value: 'kestrel' }] });

        expect(pressButton(btn(el, 'alder'))).toEqual({ name: 'brand', values: ['alder'] });
        expect(btn(el, 'alder').getAttribute('aria-pressed')).toBe('true');
    });

    it('toggles it off again', () => {
        const el = facet({ buttons: [{ value: 'alder', pressed: true }, { value: 'kestrel' }] });

        expect(pressButton(btn(el, 'alder'))).toEqual({ name: 'brand', values: [] });
        expect(btn(el, 'alder').getAttribute('aria-pressed')).toBe('false');
    });

    it('accumulates several values in DOM order, like checked inputs', () => {
        const el = facet({ buttons: [{ value: 'alder' }, { value: 'kestrel' }, { value: 'orin' }] });

        pressButton(btn(el, 'orin'));
        const result = pressButton(btn(el, 'alder'));

        expect(result.values).toEqual(['alder', 'orin']);
    });
});

describe('pressButton — radio', () => {
    it('selects one value at a time', () => {
        const el = facet({ display: 'radio', buttons: [{ value: 'alder', pressed: true }, { value: 'kestrel' }] });

        const result = pressButton(btn(el, 'kestrel'));

        expect(result.values).toEqual(['kestrel']);
        expect(pressedValues(el)).toEqual(['kestrel']);
    });

    it('clears when the selected value is pressed a second time', () => {
        const el = facet({ display: 'radio', buttons: [{ value: 'alder' }, { value: 'kestrel' }] });

        expect(pressButton(btn(el, 'alder')).values).toEqual(['alder']);
        expect(pressButton(btn(el, 'alder')).values).toEqual([]);
        expect(pressedValues(el)).toEqual([]);
    });
});

describe('pressButton — guards', () => {
    it('ignores a disabled button (a value with no results)', () => {
        const el = facet({ buttons: [{ value: 'alder' }, { value: 'tundra', count: 0, empty: true }] });

        expect(pressButton(btn(el, 'tundra'))).toBeNull();
        expect(btn(el, 'tundra').getAttribute('aria-pressed')).toBe('false');
    });

    it('lets a selected value with no results be cleared', () => {
        const el = facet({ buttons: [{ value: 'tundra', count: 0, pressed: true }] });

        expect(pressButton(btn(el, 'tundra'))).toEqual({ name: 'brand', values: [] });
    });

    it('ignores a button outside any facet', () => {
        const orphan = document.createElement('button');
        orphan.className = 'hof-btn';
        orphan.dataset.value = 'x';

        expect(pressButton(orphan)).toBeNull();
    });
});

describe('URL state is identical to list style', () => {
    beforeEach(() => {
        window.hofPublic = {};
    });

    // main.js builds a checkbox facet's values from `input:checked`, in DOM
    // order. A button facet must produce the same array for the same picks.
    function listValues(picks) {
        const el = document.createElement('div');
        el.innerHTML = ['alder', 'kestrel', 'orin']
            .map((v) => `<input type="checkbox" value="${v}" ${picks.includes(v) ? 'checked' : ''}>`)
            .join('');
        return Array.from(el.querySelectorAll('input[type="checkbox"]:checked')).map((cb) => cb.value);
    }

    it('produces the same hof[brand] URL for the same picks', () => {
        const el = facet({ buttons: [{ value: 'alder' }, { value: 'kestrel' }, { value: 'orin' }] });
        pressButton(btn(el, 'kestrel'));
        const { values } = pressButton(btn(el, 'alder'));

        const fromButtons = buildUrl({ brand: values }, 'https://shop.test/shop/').toString();
        const fromList = buildUrl({ brand: listValues(['alder', 'kestrel']) }, 'https://shop.test/shop/').toString();

        expect(fromButtons).toBe(fromList);
        expect(decodeURIComponent(fromButtons)).toContain('hof[brand][0]=alder');
    });

    it('lands in the store with the same shape as a checkbox change', () => {
        const el = facet({ buttons: [{ value: 'alder' }, { value: 'kestrel' }] });
        const store = new Store();

        const { name, values } = pressButton(btn(el, 'alder'));
        store.set(name, values);

        expect(store.get()).toEqual({ brand: ['alder'] });
    });

    it('a radio press produces the single-element array the radio path does', () => {
        const el = facet({ display: 'radio', buttons: [{ value: 'alder' }, { value: 'kestrel' }] });
        const store = new Store();

        const { name, values } = pressButton(btn(el, 'kestrel'));
        store.set(name, values);

        expect(store.get()).toEqual({ brand: ['kestrel'] });
    });
});

describe('patchButtons', () => {
    it('updates counts, pressed and empty state from the fresh render', () => {
        const current = facet({ buttons: [{ value: 'alder', count: 5 }, { value: 'kestrel', count: 4 }] });
        const incoming = facet({
            buttons: [{ value: 'alder', count: 2, pressed: true }, { value: 'kestrel', count: 0, empty: true }],
        });

        patchButtons(current, incoming);

        expect(btn(current, 'alder').querySelector('.hof-btn__count').textContent).toBe('2');
        expect(btn(current, 'alder').getAttribute('aria-pressed')).toBe('true');
        expect(btn(current, 'kestrel').disabled).toBe(true);
        expect(btn(current, 'kestrel').classList.contains('hof-btn--empty')).toBe(true);
    });

    it('re-enables a value that has results again', () => {
        const current = facet({ buttons: [{ value: 'kestrel', count: 0, empty: true }] });
        const incoming = facet({ buttons: [{ value: 'kestrel', count: 3 }] });

        patchButtons(current, incoming);

        expect(btn(current, 'kestrel').disabled).toBe(false);
        expect(btn(current, 'kestrel').classList.contains('hof-btn--empty')).toBe(false);
    });

    it('keeps the focused button in the DOM so keyboard focus survives', () => {
        const current = facet({ buttons: [{ value: 'alder' }, { value: 'kestrel' }] });
        const incoming = facet({ buttons: [{ value: 'alder' }] });
        const focused = btn(current, 'kestrel');
        focused.focus();
        expect(document.activeElement).toBe(focused);

        patchButtons(current, incoming);

        expect(btn(current, 'kestrel')).toBe(focused);
        expect(document.activeElement).toBe(focused);
    });

    it('removes buttons that went away and adds ones that appeared', () => {
        const current = facet({ buttons: [{ value: 'alder' }, { value: 'kestrel' }] });
        const incoming = facet({ buttons: [{ value: 'alder' }, { value: 'orin', count: 7 }] });

        patchButtons(current, incoming);

        expect(btn(current, 'kestrel')).toBeNull();
        expect(btn(current, 'orin').querySelector('.hof-btn__count').textContent).toBe('7');
    });

    it('does not leave the moved node in the incoming copy', () => {
        const current = facet({ buttons: [{ value: 'alder' }] });
        const incoming = facet({ buttons: [{ value: 'alder' }, { value: 'orin' }] });

        patchButtons(current, incoming);

        expect(btn(incoming, 'orin')).not.toBeNull();
    });
});

describe('button stylesheet', () => {
    const css = readFileSync(
        resolve(dirname(fileURLToPath(import.meta.url)), '../../public/src/styles/facets.css'),
        'utf8'
    );
    // Every rule whose selector mentions .hof-btn or the button row.
    const rules = [...css.matchAll(/([^{}]*\.hof-(?:btn|facet__buttons)[^{}]*)\{([^}]*)\}/g)].map((m) => ({
        selector: m[1].trim(),
        body: m[2],
    }));

    it('defines every modifier the renderer can emit', () => {
        const selectors = rules.map((r) => r.selector).join('\n');

        for (const cls of ['.hof-btn--pill', '.hof-btn--square', '.hof-btn--tinted', '.hof-btn--empty', '.hof-btn__count', '.hof-facet__buttons']) {
            expect(selectors).toContain(cls);
        }
        expect(selectors).toContain('.hof-btn[aria-pressed="true"]');
    });

    it('takes every color, radius and font from tokens — no literal colors', () => {
        expect(rules.length).toBeGreaterThan(6);
        for (const { selector, body } of rules) {
            expect(body, selector).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
            expect(body, selector).not.toMatch(/\brgba?\(/);
        }
    });

    it('reads the palette from --hof-primary and --hof-on-primary', () => {
        const pressed = rules.find((r) => r.selector.includes('[aria-pressed="true"]'));

        expect(pressed.body).toContain('var(--hof-primary)');
        expect(pressed.body).toContain('var(--hof-on-primary)');
    });

    it('uses radius tokens for both shapes', () => {
        expect(rules.find((r) => r.selector === '.hof-btn--pill').body).toContain('var(--hof-radius-pill)');
        expect(rules.find((r) => r.selector === '.hof-btn--square').body).toContain('var(--hof-radius-md)');
    });

    it('defines every token the button rules read', () => {
        const used = new Set(rules.flatMap((r) => [...r.body.matchAll(/var\((--hof-[a-z-]+)/g)].map((m) => m[1])));
        for (const token of used) {
            expect(css, token).toMatch(new RegExp(`${token}:`));
        }
    });
});
