import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The admin's look comes from tokens. tokens.css is the only file that spells
// a color, radius or font; everything else reads a --hof-* name. These guard
// that contract so a stray hex, gradient or shadow can't creep back in.

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../admin/src');
const read = (p) => readFileSync(resolve(dir, p), 'utf8');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const admin = strip(read('styles/admin.css'));
const tokens = strip(read('styles/tokens.css'));

const declarations = (css) =>
    [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap((m) =>
        m[2].split(';').map((d) => d.trim()).filter(Boolean).map((d) => ({ selector: m[1].trim(), decl: d }))
    );
const decls = declarations(admin);

describe('admin.css reads tokens, not literals', () => {
    it('spells no hex colors', () => {
        expect(admin.match(/#[0-9a-fA-F]{3,8}\b/g) || []).toEqual([]);
    });

    it('spells no rgb(), hsl() or named-color functions', () => {
        expect(admin.match(/\b(rgba?|hsla?|hwb|lab|lch)\(/g) || []).toEqual([]);
    });

    it('uses no gradients', () => {
        expect(admin.match(/-gradient\(/g) || []).toEqual([]);
    });

    it('uses no shadows (box-shadow may only be reset with none)', () => {
        const bad = decls.filter((d) => /^(box|text)-shadow\s*:/.test(d.decl) && !/:\s*none$/.test(d.decl));
        expect(bad.map((d) => `${d.selector} { ${d.decl} }`)).toEqual([]);
        expect(admin).not.toMatch(/drop-shadow\(/);
    });

    it('takes every font family from a token', () => {
        const bad = decls.filter((d) => /^font-family\s*:/.test(d.decl) && !/^font-family\s*:\s*(var\(--hof-font[a-z-]*\)|inherit)$/.test(d.decl));
        expect(bad.map((d) => `${d.selector} { ${d.decl} }`)).toEqual([]);
    });

    it('takes larger radii from tokens (only 4px/5px details and circles are literal)', () => {
        const bad = decls.filter((d) => {
            const m = d.decl.match(/^border-radius\s*:\s*(.+)$/);
            if (!m) return false;
            return m[1].split(/\s+/).some((v) => /^\d+px$/.test(v) && parseInt(v, 10) > 5);
        });
        expect(bad.map((d) => `${d.selector} { ${d.decl} }`)).toEqual([]);
    });

    it('defines every --hof-* token it reads', () => {
        const used = new Set([...admin.matchAll(/var\((--hof-[a-z0-9-]+)/g)].map((m) => m[1]));
        const defined = new Set([...(tokens + admin).matchAll(/(--hof-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
        // Blueprint sets the card size inline from the selected size (with a fallback in the rule).
        const inline = new Set(['--hof-bp-card-w', '--hof-bp-card-h']);
        const missing = [...used].filter((t) => !defined.has(t) && !inline.has(t));

        expect(missing).toEqual([]);
    });

    it('makes no request to a font CDN', () => {
        expect(read('styles/admin.css') + read('styles/tokens.css')).not.toMatch(/fonts\.googleapis|fonts\.gstatic|typekit/i);
    });
});

describe('brand tokens', () => {
    const value = (name) => tokens.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))?.[1].trim();

    it('carries the brand palette in tokens.css', () => {
        expect(value('--hof-color-hook-purple')).toBe('#534AB7');
        expect(value('--hof-color-facet-coral')).toBe('#D85A30');
        expect(value('--hof-bg')).toBe('var(--hof-color-page)');
        expect(value('--hof-color-page')).toBe('#F5F4FB');
        expect(value('--hof-surface')).toBe('#FFFFFF');
    });

    it('sizes panels at 8px and controls at 6px', () => {
        expect(value('--hof-radius-md')).toBe('8px');
        expect(value('--hof-radius-sm')).toBe('6px');
    });

    it('points the semantic names at the brand tokens', () => {
        expect(value('--hof-primary')).toBe('var(--hof-color-hook-purple)');
        expect(value('--hof-danger')).toBe('var(--hof-color-facet-coral)');
    });

    it('scopes the tokens to the page body so the content area follows --hof-bg', () => {
        expect(tokens).toMatch(/body\.toplevel_page_hooked-on-facets/);
    });
});

describe('page and panel surfaces', () => {
    const rule = (selector) => admin.match(new RegExp(`(?:^|\\})\\s*${selector.replace(/[.#[\]()]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] || '';

    it('paints the page with --hof-bg', () => {
        expect(rule('#hof-admin-root')).toContain('background: var(--hof-bg)');
    });

    it('draws cards as --hof-surface with a 1px --hof-border and an 8px radius', () => {
        for (const sel of ['.hof-panel', '.hof-stat', '.hof-table-wrap']) {
            const body = rule(sel);
            expect(body, sel).toContain('background: var(--hof-surface)');
            expect(body, sel).toContain('border: 1px solid var(--hof-border)');
            expect(body, sel).toContain('border-radius: var(--hof-radius-md)');
        }
    });

    it('draws controls with a 6px radius', () => {
        expect(admin).toMatch(/#hof-admin-root \.hof-input \{[^}]*border-radius: var\(--hof-radius-sm\)/);
        expect(rule('.hof-btn')).toContain('border-radius: var(--hof-radius-sm)');
    });
});

describe('buttons and pills', () => {
    const rule = (selector) => admin.match(new RegExp(`(?:^|\\})\\s*${selector.replace(/[.#[\]()]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] || '';

    it('makes primary buttons --hof-primary on --hof-on-primary', () => {
        const body = rule('.hof-btn-primary');
        expect(body).toContain('background: var(--hof-primary)');
        expect(body).toContain('color: var(--hof-on-primary)');
    });

    it('outlines the Help button in --hof-danger, never fills it', () => {
        const body = rule('.hof-btn-help');
        expect(body).toContain('border-color: var(--hof-danger)');
        expect(body).toContain('color: var(--hof-danger)');
        expect(body).not.toContain('background');
    });

    it('has no other coral button', () => {
        expect(admin).not.toMatch(/\.hof-btn-coral/);
        const filled = decls.filter((d) => /^\.hof-btn/.test(d.selector) && /^background\s*:\s*var\(--hof-danger\)$/.test(d.decl));
        // The destructive hover fill is the only allowed one.
        expect(filled.map((d) => d.selector)).toEqual(['.hof-btn-danger:hover:not(:disabled)']);
    });

    it('defines the four pill tones: neutral, good, busy (coral) and pro (purple)', () => {
        expect(rule('.hof-pill')).toBeTruthy();
        expect(rule('.hof-pill-good')).toContain('var(--hof-good)');
        expect(rule('.hof-pill-busy')).toContain('var(--hof-danger)');
        expect(rule('.hof-pill-pro')).toContain('var(--hof-primary)');
    });
});

describe('the rail', () => {
    it('marks the active item with a 2px left rule', () => {
        expect(admin).toMatch(/\.hof-rail-item\[aria-current="page"\] \{[^}]*border-left-color: var\(--hof-primary\)/);
        expect(admin).toMatch(/\.hof-rail-item \{[^}]*border-left: 2px solid transparent/);
    });

    it('becomes a horizontal scroll strip on narrow screens', () => {
        const narrow = admin.match(/@media \(max-width: 900px\) \{([\s\S]*?)\n\}\n/)?.[1] || '';
        expect(narrow).toMatch(/\.hof-rail \{[^}]*flex-direction: row/);
        expect(narrow).toMatch(/\.hof-rail \{[^}]*overflow-x: auto/);
        expect(narrow).toMatch(/\.hof-shell \{[^}]*grid-template-columns: 1fr/);
    });
});

describe('fonts', () => {
    it('bundles Geist Sans and Geist Mono instead of loading them from a CDN', () => {
        const main = readFileSync(resolve(dir, 'main.jsx'), 'utf8');
        expect(main).toContain("@fontsource-variable/geist/wght.css");
        expect(main).toContain("@fontsource-variable/geist-mono/wght.css");
    });

    it('lists the bundled families first in the font tokens', () => {
        expect(tokens).toMatch(/--hof-font-sans:\s*'Geist Variable'/);
        expect(tokens).toMatch(/--hof-font-mono:\s*'Geist Mono Variable'/);
    });
});
