import { useEffect, useMemo, useRef, useState } from 'react';
import { previewFacet } from '../../api.js';
import PreviewFacet from './PreviewFacet.jsx';
import StaticPreview from './StaticPreviews.jsx';

const nf = new Intl.NumberFormat('en-US');

// Displays we can run against live data in the admin. The rest (signature
// Pro displays and view-only types) keep an illustrative static preview.
export const LIVE_DISPLAYS = new Set([
    'checkbox', 'radio', 'dropdown', 'hierarchy', 'swatch', 'range', 'date_range', 'search', 'toggle',
]);

const DEBOUNCE_MS = 150;
const EMPTY = { values: [], min: null, max: null, q: '' };

/**
 * Real facet + real results for the facet as it is right now, saved or not.
 * Each change to the config or the preview selection re-queries after a
 * 150 ms pause; stale responses are dropped.
 */
export default function LivePreview({ facet, postType }) {
    const live = LIVE_DISPLAYS.has(facet.display);
    const ready = live && !!facet.source && !!postType;

    // What the shopper has picked in the preview, scoped to the config it was
    // picked against so changing source or type starts clean without an effect.
    const scope = `${postType}|${facet.kind}|${facet.source}|${facet.display}`;
    const [picked, setPicked] = useState({ scope, sel: EMPTY });
    const selection = picked.scope === scope ? picked.sel : EMPTY;
    const setSelection = (patch) => setPicked({ scope, sel: { ...selection, ...patch } });

    const [state, setState] = useState({ data: null, sel: EMPTY, error: null, loading: false });
    const seq = useRef(0);

    const request = useMemo(() => ({
        facet: {
            name: facet.name || 'preview',
            label: facet.label,
            kind: facet.kind,
            source: facet.source,
            display: facet.display,
            settings: facet.settings || {},
            post_type: postType,
        },
        selection: { ...selection, match: facet.settings?.match || 'any' },
    }), [facet.name, facet.label, facet.kind, facet.source, facet.display, facet.settings, postType, selection]);

    const key = JSON.stringify(request);
    useEffect(() => {
        if (!ready) return undefined;
        const id = ++seq.current;
        const controller = new AbortController();
        setState((s) => ({ ...s, loading: true }));
        const timer = setTimeout(() => {
            previewFacet(request.facet, request.selection, { signal: controller.signal })
                .then((data) => {
                    if (id === seq.current) setState({ data, sel: request.selection, error: null, loading: false });
                })
                .catch((e) => {
                    if (e?.name === 'AbortError' || id !== seq.current) return;
                    setState((s) => ({ ...s, error: e?.message || 'Preview failed', loading: false }));
                });
        }, DEBOUNCE_MS);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
        // `key` captures every input of the request.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, ready]);

    if (!live) {
        return (
            <div className="hof-lp">
                <div className="hof-lp-head"><h2>Preview</h2></div>
                <StaticPreview facet={facet} />
                <p className="hof-preview-note">
                    This type is illustrated here and runs against your content on the live site.
                </p>
            </div>
        );
    }

    if (!ready) {
        return (
            <div className="hof-lp">
                <div className="hof-lp-head"><h2>Preview</h2></div>
                <div className="hof-empty-state">
                    {postType ? 'Pick a source and the preview runs against your content.' : 'Pick what this facet applies to.'}
                </div>
            </div>
        );
    }

    const { data, error, loading, sel: answered } = state;
    const noun = data?.post_type?.label || 'items';
    const noValues = data && (facet.display === 'range' || facet.display === 'date_range'
        ? data.bounds.min === null
        : data.values.length === 0 && facet.display !== 'search' && facet.display !== 'toggle');

    // Summarise the selection the data answers, not the one being typed, so the
    // count and the words never disagree while a request is in flight.
    const summary = selectionSummary(facet, answered, data);

    return (
        <div className="hof-lp">
            <div className="hof-lp-head">
                <h2>Preview</h2>
                <span className="hof-lp-stats">
                    {data ? `${nf.format(data.total)} ${noun} · ${facet.source} · ${data.ms} ms` : 'Running…'}
                </span>
                <span className={`hof-pill ${loading ? 'hof-pill-busy' : 'hof-pill-good'}`}>
                    <i aria-hidden="true" />{loading ? 'Updating' : 'Live'}
                </span>
            </div>

            {error && <p className="hof-error" role="alert">{error}</p>}

            {data && (
                <div className="hof-lp-store">
                    {noValues ? (
                        <div className="hof-pv-facet">
                            <h3 className="hof-pv-title">{facet.label || facet.name || 'Facet'}</h3>
                            <div className="hof-empty-state">
                                No values yet. Tag some {noun} with a {facet.source} and they appear here.
                            </div>
                        </div>
                    ) : (
                        <PreviewFacet
                            facet={facet}
                            values={data.values}
                            bounds={data.bounds}
                            selection={selection}
                            onChange={setSelection}
                        />
                    )}
                    <div className="hof-lp-results" aria-live="polite">
                        <div className="hof-lp-count">
                            {nf.format(data.count)} of {nf.format(data.total)} {noun}{summary}
                        </div>
                        {data.sampled && (
                            <p className="hof-lp-sampled">Preview reads the newest {nf.format(5000)} items.</p>
                        )}
                        {data.items.length === 0 ? (
                            <div className="hof-empty-state">Nothing matches. Try a different pick.</div>
                        ) : (
                            <div className="hof-lp-grid">
                                {data.items.map((item) => (
                                    <div key={item.id} className="hof-lp-card">
                                        <div
                                            className="hof-lp-thumb"
                                            style={item.image ? { backgroundImage: `url("${item.image}")` } : undefined}
                                        />
                                        <div className="hof-lp-card-text">
                                            <b>{item.title || `#${item.id}`}</b>
                                            {item.meta && <span>{item.meta}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function selectionSummary(facet, sel, data) {
    if (!data) return '';
    if (facet.display === 'search' && sel.q) return ` matching “${sel.q}”`;
    if ((facet.display === 'range' || facet.display === 'date_range') && (sel.min != null || sel.max != null)) {
        return sel.max != null ? ` · up to ${nf.format(sel.max)}` : '';
    }
    if (sel.values.length) {
        const names = sel.values.map((v) => data.values.find((x) => x.value === v)?.label || v);
        return ` · ${names.join(facet.settings?.match === 'all' ? ' and ' : ', ')}`;
    }
    return '';
}
