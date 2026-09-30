import { scopeCss } from './customCss.js';

// The tokens the Design tokens screen edits, in the order it lists them.
// Names are the CSS variables; PHP (brand-tokens.json) owns the brand values.
export const TOKEN_GROUPS = [
    {
        title: 'Color',
        tokens: [
            { name: '--hof-primary', label: 'Primary', kind: 'color' },
            { name: '--hof-on-primary', label: 'On primary', kind: 'color' },
            { name: '--hof-text', label: 'Text', kind: 'color' },
            { name: '--hof-muted', label: 'Muted text', kind: 'color' },
            { name: '--hof-surface', label: 'Surface', kind: 'color' },
            { name: '--hof-bg', label: 'Background', kind: 'color' },
            { name: '--hof-border', label: 'Border', kind: 'color' },
            { name: '--hof-danger', label: 'Danger', kind: 'color' },
        ],
    },
    {
        title: 'Shape',
        tokens: [
            { name: '--hof-radius-sm', label: 'Radius, small', kind: 'text' },
            { name: '--hof-radius-md', label: 'Radius, medium', kind: 'text' },
            { name: '--hof-radius-pill', label: 'Radius, pill', kind: 'text' },
        ],
    },
    {
        title: 'Type and space',
        tokens: [
            { name: '--hof-space', label: 'Space unit', kind: 'text' },
            { name: '--hof-font-body', label: 'Body font', kind: 'text' },
            { name: '--hof-font-mono', label: 'Mono font', kind: 'text' },
        ],
    },
];

// Public facets read tokens from these two selectors, not :root, so an
// override on :root never reaches them. See public/src/styles/facets.css.
export const TOKEN_SELECTOR = '.hof-facet, .hof-results';

const HEX6 = /^#[0-9a-f]{6}$/i;
export const isHex = (v) => HEX6.test(String(v || '').trim());

export function tokenBlock(tokens) {
    const lines = Object.entries(tokens)
        .filter(([, v]) => String(v).trim() !== '')
        .map(([k, v]) => `    ${k}: ${String(v).trim()};`);
    return `${TOKEN_SELECTOR} {\n${lines.join('\n')}\n}`;
}

// What the front end will print: the token block, then the site CSS, scoped
// to one facet when asked.
export function customCssFor({ customCss, scope, facet }) {
    const css = String(customCss || '').trim();
    if (css === '') return '';
    return scope === 'facet' && facet ? scopeCss(css, facet) : css;
}

export function generatedCss(state) {
    const custom = customCssFor(state);
    return custom === '' ? tokenBlock(state.tokens) : `${tokenBlock(state.tokens)}\n\n${custom}`;
}

// @import in the preview would make the admin fetch whatever a draft names.
export const previewSafe = (css) => String(css).replace(/@import[^;]*;?/gi, '');
