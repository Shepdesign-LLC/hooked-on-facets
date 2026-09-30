import { useEffect, useMemo, useRef, useState } from 'react';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import { saveTokens } from '../api.js';
import Tip from './ui/Tip.jsx';
import { Seg } from './editor/TypeSettings.jsx';
import publicCss from '../../../public/src/styles/facets.css?inline';
import {
    TOKEN_GROUPS,
    customCssFor,
    generatedCss,
    isHex,
    previewSafe,
    tokenBlock,
} from '../lib/tokens.js';

const TOKENS_TIP =
    'A token is a named value like --hof-primary. Facets use the name, not the color, so changing the value ' +
    'restyles everything at once. Bricks global classes on HOF elements read these same variables.';

const CSS_TIP =
    'Anything you write here loads after the tokens, on the front end and in this preview. Use the hof- classes and ' +
    'the tokens above. Scope it to one facet with .hof-facet--<slug>, or leave it site-wide.';

const DOCS_URL = 'https://hookedonfacets.com/docs/design-tokens/';

// The preview facets: a list and a button facet, as the front end renders them.
// Static text only. The facet slug is the one part that varies, and it is
// reduced to [a-z0-9_-] before it gets here.
function previewMarkup(slug) {
    const cls = `hof-facet--${slug}`;
    return `
<div class="hof-facet hof-facet-checkbox ${cls}">
  <fieldset class="hof-facet-fieldset">
    <legend class="hof-facet-label">Brand</legend>
    <ul class="hof-facet-options">
      <li class="hof-facet-option"><label><input type="checkbox" checked></label><span class="hof-facet-name">Alder</span><span class="hof-facet-count">5</span></li>
      <li class="hof-facet-option"><label><input type="checkbox"></label><span class="hof-facet-name">Kestrel</span><span class="hof-facet-count">4</span></li>
      <li class="hof-facet-option"><label><input type="checkbox"></label><span class="hof-facet-name">Orin</span><span class="hof-facet-count">3</span></li>
    </ul>
  </fieldset>
</div>
<div class="hof-facet hof-facet-checkbox ${cls}" data-hof-style="buttons" style="margin-top:14px">
  <fieldset class="hof-facet-fieldset">
    <legend class="hof-facet-label">Brand, as buttons</legend>
    <div class="hof-facet__buttons">
      <button type="button" class="hof-btn hof-btn--pill hof-btn--outline" aria-pressed="true">Alder <span class="hof-btn__count">5</span></button>
      <button type="button" class="hof-btn hof-btn--pill hof-btn--outline" aria-pressed="false">Kestrel <span class="hof-btn__count">4</span></button>
      <button type="button" class="hof-btn hof-btn--pill hof-btn--outline hof-btn--empty" aria-pressed="false" disabled>Tundra <span class="hof-btn__count">0</span></button>
    </div>
  </fieldset>
</div>`;
}

// Rendered in a shadow root so the public stylesheet and the site's custom CSS
// apply to the preview alone. The admin has its own .hof-btn, and the public
// one must not fight it.
function ShadowPreview({ tokens, customCss, slug }) {
    const host = useRef(null);
    const shadow = useRef(null);

    useEffect(() => {
        if (!host.current) return;
        shadow.current = host.current.shadowRoot || host.current.attachShadow({ mode: 'open' });
    }, []);

    useEffect(() => {
        const root = host.current?.shadowRoot || shadow.current;
        if (!root) return;
        const style = document.createElement('style');
        style.textContent = `${publicCss}\n${tokenBlock(tokens)}\n${previewSafe(customCss)}`;
        const body = document.createElement('div');
        body.innerHTML = previewMarkup(slug);
        root.replaceChildren(style, body);
    }, [tokens, customCss, slug]);

    return <div ref={host} className="hof-tk-shadow" data-testid="tokens-preview" />;
}

function TokenRow({ token, value, onChange }) {
    const id = `hof-tk-${token.name.slice(2)}`;
    return (
        <div className="hof-tk-row">
            <label htmlFor={id}>
                {token.label}
                <code>{token.name}</code>
            </label>
            {token.kind === 'color' && (
                <input
                    type="color"
                    className="hof-tk-swatch"
                    aria-label={`${token.label} picker`}
                    value={isHex(value) ? value : '#000000'}
                    disabled={!isHex(value)}
                    onChange={(e) => onChange(e.target.value)}
                />
            )}
            <input
                id={id}
                type="text"
                className="hof-input hof-mono"
                value={value ?? ''}
                spellCheck="false"
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
}

export default function DesignTokens({ initial, facets = [] }) {
    const brand = initial?.brand || {};
    const [saved, setSaved] = useState(() => snapshot(initial));
    const [state, setState] = useState(saved);
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState('');
    const timer = useRef(null);

    useEffect(() => () => clearTimeout(timer.current), []);

    const dirty = JSON.stringify(state) !== JSON.stringify(saved);
    const set = (patch) => setState((s) => ({ ...s, ...patch }));
    const setToken = (name, value) => setState((s) => ({ ...s, tokens: { ...s.tokens, [name]: value } }));

    const slug = state.scope === 'facet' && state.facet ? state.facet : 'preview';
    const css = useMemo(() => generatedCss(state), [state]);
    // The preview applies the same scoping the front end will.
    const previewCss = useMemo(() => customCssFor(state), [state]);

    const say = (msg) => {
        setNote(msg);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setNote(''), 3000);
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(css);
            say('CSS copied.');
        } catch {
            say('Could not copy. Select the CSS and copy it by hand.');
        }
    };

    const save = async () => {
        setBusy(true);
        try {
            const res = await saveTokens({
                tokens: state.tokens,
                custom_css: state.customCss,
                scope: state.scope,
                facet: state.facet,
            });
            const next = snapshot(res);
            setSaved(next);
            setState(next);
            say('Saved. Admin colors update on the next page load.');
        } catch (e) {
            say(`Could not save: ${e.message}`);
        } finally {
            setBusy(false);
        }
    };

    const chooseScope = (scope) => {
        set({ scope, facet: scope === 'facet' ? state.facet || facets[0]?.name || '' : state.facet });
    };

    return (
        <div className="hof-tokens">
            <header className="hof-view-header">
                <div className="hof-view-heading">
                    <h2 className="hof-view-title">Design tokens</h2>
                    <p className="hof-lede">
                        CSS variables that every hooked on facets surface reads, admin and public. Change one here
                        and every facet on the site follows. Override per site in theme CSS or with the{' '}
                        <code>hof_public_css_tokens</code> filter.
                        <Tip text={TOKENS_TIP} />
                    </p>
                </div>
                <div className="hof-view-actions">
                    <button type="button" className="hof-btn" onClick={() => setState((s) => ({ ...s, tokens: { ...brand } }))}>
                        Reset to brand
                    </button>
                    <button type="button" className="hof-btn" onClick={copy}>
                        <IconCopy size={15} stroke={2} aria-hidden="true" />
                        Copy CSS
                    </button>
                    <button type="button" className="hof-btn hof-btn-primary" onClick={save} disabled={busy || !dirty}>
                        {busy ? 'Saving…' : 'Save tokens'}
                    </button>
                </div>
            </header>

            <p className="hof-tk-note" role="status" aria-live="polite">
                {note && <><IconCheck size={14} stroke={2} aria-hidden="true" /> {note}</>}
            </p>

            <div className="hof-tk-grid">
                <div className="hof-panel hof-tk-list">
                    {TOKEN_GROUPS.map((g) => (
                        <section key={g.title}>
                            <h3 className="hof-tk-sec">{g.title}</h3>
                            {g.tokens.map((t) => (
                                <TokenRow key={t.name} token={t} value={state.tokens[t.name]} onChange={(v) => setToken(t.name, v)} />
                            ))}
                        </section>
                    ))}
                </div>

                <div className="hof-tk-side">
                    <div className="hof-panel hof-tk-pad">
                        <h3 className="hof-tk-sec">Live preview</h3>
                        <ShadowPreview tokens={state.tokens} customCss={previewCss} slug={slug} />
                    </div>

                    <div className="hof-panel hof-tk-pad">
                        <div className="hof-step-head">
                            <h3 className="hof-tk-sec">Custom CSS</h3>
                            <Tip text={CSS_TIP} />
                            <a href={DOCS_URL} target="_blank" rel="noopener noreferrer">Class reference</a>
                        </div>
                        <div className="hof-row">
                            <span>Scope</span>
                            <Seg
                                label="Scope"
                                value={state.scope}
                                onChange={chooseScope}
                                options={[
                                    { value: 'site', label: 'Site-wide' },
                                    { value: 'facet', label: 'This facet' },
                                ]}
                            />
                        </div>
                        {state.scope === 'facet' && (
                            <div className="hof-row">
                                <label htmlFor="hof-tk-facet">Facet</label>
                                <select
                                    id="hof-tk-facet"
                                    className="hof-input"
                                    value={state.facet}
                                    onChange={(e) => set({ facet: e.target.value })}
                                >
                                    {facets.length === 0 && <option value="">No facets yet</option>}
                                    {facets.map((f) => (
                                        <option key={f.name} value={f.name}>{f.label || f.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <textarea
                            className="hof-tk-css hof-mono"
                            rows={7}
                            spellCheck="false"
                            aria-label="Custom CSS"
                            value={state.customCss}
                            onChange={(e) => set({ customCss: e.target.value })}
                        />
                        <p className="hof-note">
                            Live in the preview as you type. Saved with the tokens. Unsafe declarations (imports,
                            scripts, non-http urls) are removed on save.
                        </p>
                    </div>

                    <div className="hof-panel hof-tk-pad">
                        <h3 className="hof-tk-sec">Generated CSS</h3>
                        <pre className="hof-tk-pre hof-mono" data-testid="tokens-css">{css}</pre>
                    </div>
                </div>
            </div>
        </div>
    );
}

function snapshot(d) {
    return {
        tokens: { ...(d?.tokens || {}) },
        customCss: d?.custom_css || '',
        scope: d?.scope === 'facet' ? 'facet' : 'site',
        facet: d?.facet || '',
    };
}
