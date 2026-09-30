// Scope custom CSS to one facet: prefix every rule's selectors with
// `.hof-facet--<slug>`. A port of DesignTokens::scope_css (PHP), and both are
// tested against tests/fixtures/custom-css.json, so the preview shows what
// the front end will print.

const NESTING_AT_RULES = new Set(['media', 'supports', 'layer', 'container']);

export function scopeCss(css, slug) {
    const clean = String(slug || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (clean === '' || String(css).trim() === '') return css;
    return scopeBlock(css, `.hof-facet--${clean}`);
}

function scopeBlock(css, prefix) {
    let out = '';
    let start = 0;
    let quote = '';
    let paren = 0;

    for (let i = 0; i < css.length; i++) {
        const c = css[i];
        if (quote !== '') {
            if (c === '\\') i++;
            else if (c === quote) quote = '';
            continue;
        }
        if (c === '"' || c === "'") { quote = c; continue; }
        if (c === '\\') { i++; continue; }
        if (c === '(' || c === '[') { paren++; continue; }
        if (c === ')' || c === ']') { paren = Math.max(0, paren - 1); continue; }
        if (paren > 0) continue;
        if (c === ';' || c === '}') {
            out += css.slice(start, i + 1);
            start = i + 1;
            continue;
        }
        if (c !== '{') continue;

        const prelude = css.slice(start, i);
        const end = matchingBrace(css, i);
        const body = css.slice(i + 1, end);
        const at = /^\s*@([a-z-]+)/i.exec(prelude);

        if (at) {
            const recurse = NESTING_AT_RULES.has(at[1].toLowerCase());
            out += `${prelude}{${recurse ? scopeBlock(body, prefix) : body}}`;
        } else {
            out += `${scopeSelectors(prelude, prefix)}{${body}}`;
        }
        i = end;
        start = end + 1;
    }
    return out + css.slice(start);
}

function matchingBrace(css, open) {
    let depth = 0;
    let quote = '';
    for (let i = open; i < css.length; i++) {
        const c = css[i];
        if (quote !== '') {
            if (c === '\\') i++;
            else if (c === quote) quote = '';
            continue;
        }
        if (c === '"' || c === "'") quote = c;
        else if (c === '\\') i++;
        else if (c === '{') depth++;
        else if (c === '}' && --depth === 0) return i;
    }
    return css.length;
}

function scopeSelectors(prelude, prefix) {
    const lead = /^\s*/.exec(prelude)[0];
    const trail = /\s*$/.exec(prelude)[0];
    const core = prelude.trim();
    if (core === '') return prelude;

    const parts = [];
    let depth = 0;
    let quote = '';
    let buf = '';
    for (let i = 0; i < core.length; i++) {
        const c = core[i];
        if (quote !== '') {
            buf += c;
            if (c === '\\' && i + 1 < core.length) buf += core[++i];
            else if (c === quote) quote = '';
            continue;
        }
        if (c === '"' || c === "'") quote = c;
        else if (c === '(' || c === '[') depth++;
        else if (c === ')' || c === ']') depth = Math.max(0, depth - 1);
        else if (c === ',' && depth === 0) {
            parts.push(buf.trim());
            buf = '';
            continue;
        }
        buf += c;
    }
    parts.push(buf.trim());

    const scoped = parts
        .filter((p) => p !== '')
        .map((sel) => (/^\.hof-facet(?![A-Za-z0-9_-])/.test(sel) ? prefix + sel : `${prefix} ${sel}`));

    return lead + scoped.join(', ') + trail;
}
