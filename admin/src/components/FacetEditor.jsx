import { useEffect, useState } from 'react';
import { validateFacet } from '../validation.js';
import { getSources } from '../api.js';
import { orderPostTypes, postTypeOf } from '../lib/facets.js';
import {
    SOURCE_GROUPS,
    TYPES,
    VIEW_TYPES,
    explainer,
    findSource,
    sourceId,
    sourceOptionLabel,
    sourcePatch,
    typeState,
} from '../lib/sources.js';
import Tip from './ui/Tip.jsx';
import LivePreview from './editor/LivePreview.jsx';
import PlaceIt from './editor/PlaceIt.jsx';
import { BehaviorFields, COLOR_TARGETS, DisplayFields } from './editor/TypeSettings.jsx';

const TIPS = {
    appliesTo:
        'The post type this facet filters. Products is WooCommerce. Custom post types work exactly the same way. ' +
        'Search and Ask span every post type you index.',
    source: 'The data the facet reads. Pick it before the type, because the source decides which types make sense.',
    type: "How the facet looks and behaves on the page. Greyed types don't fit this source; the reason is written on each one.",
};

const KINDS = [
    { value: 'taxonomy', label: 'Taxonomy', hint: 'e.g. product_cat, category, product_tag' },
    { value: 'meta',     label: 'Post meta', hint: 'e.g. _price, _stock_status' },
    { value: 'field',    label: 'Post field', hint: 'e.g. post_title, post_author' },
];

const DOCS = 'https://hookedonfacets.com/docs';

const slugify = (raw) =>
    String(raw || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');

const sanitizeSlug = (raw) => String(raw || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

// Last catalog seen per post type. Shown instantly on the next open while a
// fresh one loads, so counts never go stale but the picker never flashes empty.
const catalogCache = new Map();

function useSources(postType) {
    const [state, setState] = useState(() => ({
        sources: catalogCache.get(postType) || null,
        loading: !!postType && !catalogCache.has(postType),
        error: null,
    }));

    useEffect(() => {
        if (!postType) {
            setState({ sources: null, loading: false, error: null });
            return undefined;
        }
        let live = true;
        const cached = catalogCache.get(postType) || null;
        setState({ sources: cached, loading: !cached, error: null });
        getSources(postType)
            .then((res) => {
                const sources = Array.isArray(res.sources) ? res.sources : [];
                catalogCache.set(postType, sources);
                if (live) setState({ sources, loading: false, error: null });
            })
            .catch((e) => {
                if (live) setState({ sources: cached, loading: false, error: e?.message || 'Could not load sources' });
            });
        return () => { live = false; };
    }, [postType]);

    return state;
}

export default function FacetEditor({
    facet,
    onChange,
    onDelete,
    allFacets = [],
    availableDisplays = null,
    postTypes = [],
    stats = null,
}) {
    const settings = isObject(facet.settings) ? facet.settings : {};
    const update = (patch) => onChange({ settings: { ...settings, ...patch } });
    const issues = validateFacet(facet, allFacets);
    const isView = VIEW_TYPES.has(facet.display);

    const postType = postTypeOf(facet, stats);
    const { sources, loading, error } = useSources(postType);
    const source = findSource(sources, facet);
    const noun = (postTypes.find((p) => p.slug === postType)?.label || 'items').toLowerCase();

    const colorTargetFacets = allFacets.filter((f) => COLOR_TARGETS.has(f.display) && f.name !== facet.name);
    const kindDef = KINDS.find((k) => k.value === facet.kind) || KINDS[0];

    // Applies to: an indexed post type, plus the facet's own if it isn't one
    // (a saved facet for a type since switched off must stay visible).
    const ptOptions = orderPostTypes(
        postTypes.some((p) => p.slug === postType) || !postType
            ? postTypes
            : [...postTypes, { slug: postType, label: postType }]
    );

    const setName = (value) => {
        const patch = { label: value };
        // Keep the slug following the name until the slug is edited by hand.
        if (!facet.name || facet.name === slugify(facet.label)) patch.name = slugify(value);
        onChange(patch);
    };

    const choosePostType = (slug) => {
        if (slug === postType) return;
        // A source belongs to one post type, so changing it starts the source over.
        onChange({ post_type: slug, kind: 'taxonomy', source: '', display: 'checkbox', settings: {} });
    };

    const chooseSource = (id) => {
        const src = (sources || []).find((s) => s.id === id);
        if (src) onChange(sourcePatch(src, facet, availableDisplays));
    };

    const chooseType = (value) => {
        const patch = { display: value };
        if (VIEW_TYPES.has(value)) {
            patch.kind = 'view';
            patch.source = '';
        } else if (facet.kind === 'view') {
            patch.kind = 'taxonomy';
        }
        onChange(patch);
    };

    const currentId = facet.source ? sourceId(facet.kind, facet.source) : '';
    const inCatalog = !!source;
    const groups = SOURCE_GROUPS
        .map((g) => ({ ...g, items: (sources || []).filter((s) => s.group === g.key) }))
        .filter((g) => g.items.length > 0);

    return (
        <div className="hof-ed">
            <div className="hof-ed-head">
                <input
                    className="hof-ed-name"
                    type="text"
                    value={facet.label || ''}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Facet name"
                    aria-label="Facet name"
                    aria-invalid={issues.label ? 'true' : 'false'}
                />
                <p className="hof-lede">
                    Every change updates the preview. Save writes it to the site; new sources are added to the
                    index the next time you reindex.
                </p>
                {issues.label && <span className="hof-field-error">{issues.label}</span>}
            </div>

            <div className="hof-ed-grid">
                <div className="hof-panel hof-steps">
                    <div className="hof-step">
                        <div className="hof-step-head">
                            <h2>Applies to</h2><Tip text={TIPS.appliesTo} />
                            <a href={`${DOCS}/post-types/`} target="_blank" rel="noopener noreferrer">Docs</a>
                        </div>
                        {ptOptions.length === 0 ? (
                            <p className="hof-field-help">
                                No post types are indexed yet. Turn one on under Settings → Post types.
                            </p>
                        ) : (
                            <div className="hof-seg" role="group" aria-label="Applies to">
                                {ptOptions.map((p) => (
                                    <button
                                        key={p.slug}
                                        type="button"
                                        aria-pressed={p.slug === postType}
                                        onClick={() => choosePostType(p.slug)}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="hof-step">
                        <div className="hof-step-head">
                            <h2>Source</h2><Tip text={TIPS.source} />
                            <a href={`${DOCS}/sources/`} target="_blank" rel="noopener noreferrer">Docs</a>
                        </div>
                        {isView ? (
                            <p className="hof-field-help">
                                {TYPES.find((t) => t.value === facet.display)?.label} doesn&apos;t read a source. It
                                drives other facets or the results themselves.
                            </p>
                        ) : (
                            <>
                                <select
                                    className="hof-input"
                                    aria-label="Source"
                                    aria-invalid={issues.source ? 'true' : 'false'}
                                    value={currentId}
                                    disabled={!postType || loading}
                                    onChange={(e) => chooseSource(e.target.value)}
                                >
                                    <option value="" disabled>
                                        {!postType ? 'Pick what this facet applies to' : loading ? 'Loading sources…' : 'Pick a source'}
                                    </option>
                                    {facet.source && !inCatalog && !loading && (
                                        <option value={currentId}>{kindDef.label}: {facet.source}</option>
                                    )}
                                    {groups.map((g) => (
                                        <optgroup key={g.key} label={g.label}>
                                            {g.items.map((s) => (
                                                <option key={s.id} value={s.id}>{sourceOptionLabel(s)}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                                {error && <p className="hof-field-error" role="alert">{error}</p>}
                                {issues.source && !loading && <p className="hof-field-error">{issues.source}</p>}
                                <div className="hof-explain" aria-live="polite">
                                    {explainer(inCatalog ? source : null, { noun }).map((p, i) =>
                                        p.b ? <b key={i}>{p.t}</b> : <span key={i}>{p.t}</span>
                                    )}
                                </div>

                                <details className="hof-adv">
                                    <summary>Enter a source by hand</summary>
                                    <label className="hof-field">
                                        <span className="hof-field-label">Source kind</span>
                                        <select
                                            className="hof-input"
                                            value={facet.kind === 'view' ? 'taxonomy' : facet.kind}
                                            onChange={(e) => onChange({ kind: e.target.value })}
                                        >
                                            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                                        </select>
                                    </label>
                                    <label className="hof-field">
                                        <span className="hof-field-label">Source</span>
                                        <input
                                            className="hof-input"
                                            type="text"
                                            value={facet.source || ''}
                                            onChange={(e) => onChange({ source: e.target.value })}
                                            placeholder={kindDef.hint}
                                        />
                                        <span className="hof-field-help">
                                            For a taxonomy, meta key or post field the list above doesn&apos;t offer.
                                        </span>
                                    </label>
                                </details>
                            </>
                        )}
                    </div>

                    <div className="hof-step">
                        <div className="hof-step-head">
                            <h2>Type</h2><Tip text={TIPS.type} />
                            <a href={`${DOCS}/facet-types/`} target="_blank" rel="noopener noreferrer">Docs</a>
                        </div>
                        <div className="hof-types">
                            {TYPES.map((def) => {
                                const st = typeState(def, { facet, source, available: availableDisplays, current: facet.display });
                                return (
                                    <button
                                        key={def.value}
                                        type="button"
                                        className="hof-type"
                                        aria-pressed={facet.display === def.value}
                                        disabled={st.disabled}
                                        onClick={() => chooseType(def.value)}
                                    >
                                        <b>{def.label}</b>
                                        <small>{st.subtitle}</small>
                                        {def.pro && <span className="hof-tag">Pro</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="hof-step">
                        <div className="hof-step-head"><h2>Behavior</h2></div>
                        <BehaviorFields
                            facet={facet}
                            settings={settings}
                            update={update}
                            issues={issues}
                            colorTargetFacets={colorTargetFacets}
                        />
                        {!hasBehavior(facet.display) && (
                            <p className="hof-field-help">Nothing to tune for this type.</p>
                        )}
                    </div>

                    <div className="hof-step">
                        <div className="hof-step-head"><h2>Display</h2></div>
                        <label className={`hof-field ${issues.name ? 'is-invalid' : ''}`}>
                            <span className="hof-field-label">Slug</span>
                            <input
                                className="hof-input"
                                type="text"
                                value={facet.name}
                                onChange={(e) => onChange({ name: sanitizeSlug(e.target.value) })}
                                placeholder="brand"
                                aria-invalid={issues.name ? 'true' : 'false'}
                            />
                            {issues.name
                                ? <span className="hof-field-error">{issues.name}</span>
                                : (
                                    <span className="hof-field-help">
                                        URL-safe identifier used in <code>?hof[slug]=…</code>. Lowercase, hyphens and underscores only.
                                    </span>
                                )}
                        </label>
                        <DisplayFields facet={facet} settings={settings} update={update} />
                    </div>

                    <div className="hof-step">
                        <button className="hof-btn hof-btn-danger" onClick={onDelete} type="button">
                            Delete facet
                        </button>
                    </div>
                </div>

                <div className="hof-panel hof-preview-panel">
                    <LivePreview facet={facet} postType={postType} />
                </div>
            </div>

            <PlaceIt slug={facet.name} />
        </div>
    );
}

// Whether a display has anything under Behavior.
function hasBehavior(display) {
    return ['checkbox', 'swatch', 'swiper', 'toggle', 'date_range', 'visual_dna', 'pagination'].includes(display);
}
