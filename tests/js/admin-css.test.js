import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The admin's look comes from tokens. tokens.css is the only file that spells
// a color, radius, shadow or font; everything else reads a --hof-* name. These
// guard that contract so a stray hex, gradient or ad-hoc shadow can't creep in.

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

    it('takes every shadow from an elevation token (or resets it with none)', () => {
        const ok = /^box-shadow\s*:\s*(none|var\(--hof-(shadow-(xs|sm|lg)|focus-ring)\))$/;
        const bad = decls.filter((d) => /^(box|text)-shadow\s*:/.test(d.decl) && !ok.test(d.decl));
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
        expect(value('--hof-color-page')).toBe('#F7F7F5');
        expect(value('--hof-surface')).toBe('#FFFFFF');
    });

    it('keeps the neutrals neutral: purple is the accent, not the canvas', () => {
        // The old cool-lavender neutrals read as a blueprint; ink and page are warm gray now.
        for (const name of ['--hof-color-page', '--hof-color-tint', '--hof-color-line', '--hof-color-ink', '--hof-color-muted']) {
            const [r, g, b] = value(name).match(/[0-9A-F]{2}/gi).map((h) => parseInt(h, 16));
            expect(b - Math.min(r, g), name).toBeLessThanOrEqual(2);
        }
    });

    it('sizes panels at 12px and controls at 8px', () => {
        expect(value('--hof-radius-md')).toBe('12px');
        expect(value('--hof-radius-sm')).toBe('8px');
    });

    it('defines the elevation scale in tokens.css', () => {
        for (const name of ['--hof-shadow-xs', '--hof-shadow-sm', '--hof-shadow-lg', '--hof-focus-ring']) {
            expect(value(name), name).toBeTruthy();
        }
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

    it('draws cards as --hof-surface with a 1px --hof-border, the panel radius and a soft lift', () => {
        for (const sel of ['.hof-panel', '.hof-stat', '.hof-table-wrap']) {
            const body = rule(sel);
            expect(body, sel).toContain('background: var(--hof-surface)');
            expect(body, sel).toContain('border: 1px solid var(--hof-border)');
            expect(body, sel).toContain('border-radius: var(--hof-radius-md)');
            expect(body, sel).toContain('box-shadow: var(--hof-shadow-sm)');
        }
    });

    it('keeps UI labels in the sans face: no uppercase, letter-spaced eyebrows', () => {
        const shouty = decls.filter((d) => /^text-transform\s*:\s*uppercase$/.test(d.decl));
        expect(shouty.map((d) => d.selector)).toEqual([]);
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
    it('marks the active item as a raised pill with a brand-colored icon', () => {
        expect(admin).toMatch(/\.hof-rail-item\[aria-current="page"\] \{[^}]*background: var\(--hof-surface\)[^}]*box-shadow: var\(--hof-shadow-xs\)/);
        expect(admin).toMatch(/\.hof-rail-item\[aria-current="page"\] svg \{[^}]*color: var\(--hof-primary\)/);
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
