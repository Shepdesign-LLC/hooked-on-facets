import { useCallback, useEffect, useRef, useState } from 'react';
import {
    IconArrowLeft,
    IconArrowsShuffle,
    IconChevronRight,
    IconDatabase,
    IconFilter,
    IconKey,
    IconLayoutGrid,
    IconPalette,
    IconSearch,
    IconSettings,
    IconTools,
} from '@tabler/icons-react';
import { getIndexerStats, getSuggestions, reindex, saveFacets } from './api.js';
import { pickSuggestions } from './lib/facets.js';
import { countInvalid } from './validation.js';
import FacetsList from './components/FacetsList.jsx';
import IndexStatusPill from './components/IndexStatusPill.jsx';
import FacetEditor from './components/FacetEditor.jsx';
import TokensPanel from './components/TokensPanel.jsx';
import Dashboard from './components/Dashboard.jsx';
import Blueprint from './components/Blueprint.jsx';
import Indexer from './components/Indexer.jsx';
import QueryLoops from './components/QueryLoops.jsx';
import AiSettings from './components/AiSettings.jsx';
import SeoSettings from './components/SeoSettings.jsx';
import LicenseSettings from './components/LicenseSettings.jsx';

const VIEWS = [
    { id: 'dashboard',  label: 'Dashboard',     section: 'Main',   Icon: IconLayoutGrid },
    { id: 'facets',     label: 'Facets',        section: 'Main',   Icon: IconFilter },
    { id: 'queryloops', label: 'Query loops',   section: 'Main',   Icon: IconArrowsShuffle },
    { id: 'indexer',    label: 'Indexer',       section: 'Main',   Icon: IconDatabase },
    { id: 'blueprint',  label: 'Blueprint',     section: 'Studio', Icon: IconTools },
    { id: 'tokens',     label: 'Design tokens', section: 'Studio', Icon: IconPalette },
    { id: 'seo',        label: 'SEO',           section: 'System', Icon: IconSearch },
    { id: 'license',    label: 'License',       section: 'System', Icon: IconKey },
    { id: 'settings',   label: 'Settings',      section: 'System', Icon: IconSettings },
];

const SECTION_ORDER = ['Main', 'Studio', 'System'];

const blankFacet = (postType = '') => ({
    name: '',
    label: '',
    source: '',
    kind: 'taxonomy',
    display: 'checkbox',
    ...(postType ? { post_type: postType } : {}),
});

// A new facet starts on Products when it's indexed, else the first indexed type.
const defaultPostType = (stats) => {
    const types = stats?.post_types || [];
    return (types.find((p) => p.slug === 'product') || types[0])?.slug || '';
};

export default function App({ bootstrap }) {
    const [view, setView] = useState('dashboard');
    // The License screen belongs to the HOF Pro add-on.
    const availableViews = bootstrap.proActive
        ? VIEWS
        : VIEWS.filter((v) => v.id !== 'license');
    const [facets, setFacets] = useState(() =>
        Array.isArray(bootstrap.facets) ? bootstrap.facets : []
    );
    const [selectedIdx, setSelectedIdx] = useState(null);
    // Facets screen has two states: the grouped list, and one facet's editor.
    const [facetsScreen, setFacetsScreen] = useState('list');
    const [stats, setStats] = useState(null);
    const [rawSuggestions, setRawSuggestions] = useState([]);
    const [reindexNeeded, setReindexNeeded] = useState(false);
    const [reindexing, setReindexing] = useState(false);
    const editBaseline = useRef(null);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const selected = selectedIdx !== null ? facets[selectedIdx] : null;

    const updateSelected = useCallback(
        (patch) => {
            setFacets((prev) =>
                prev.map((f, i) => (i === selectedIdx ? { ...f, ...patch } : f))
            );
            setDirty(true);
        },
        [selectedIdx]
    );

    const refreshStats = useCallback(() => {
        getIndexerStats().then(setStats).catch(() => {});
    }, []);

    useEffect(() => {
        refreshStats();
    }, [refreshStats]);

    // A running background job changes every facet's status; poll until it ends.
    const jobRunning = !!stats?.background?.running;
    useEffect(() => {
        if (!jobRunning) return undefined;
        const t = setTimeout(refreshStats, 4000);
        return () => clearTimeout(t);
    }, [jobRunning, stats, refreshStats]);

    // "Found in your content": suggestions from every active source integration.
    useEffect(() => {
        const integrations = [
            bootstrap.woocommerceActive && 'woocommerce',
            bootstrap.acfActive && 'acf',
            bootstrap.metaboxActive && 'metabox',
            bootstrap.podsActive && 'pods',
        ].filter(Boolean);
        if (integrations.length === 0) return;
        let live = true;
        Promise.allSettled(integrations.map(getSuggestions)).then((results) => {
            if (!live) return;
            setRawSuggestions(
                results.flatMap((r) =>
                    r.status === 'fulfilled' && r.value?.available && Array.isArray(r.value.facets)
                        ? r.value.facets
                        : []
                )
            );
        });
        return () => { live = false; };
    }, [bootstrap.woocommerceActive, bootstrap.acfActive, bootstrap.metaboxActive, bootstrap.podsActive]);

    const suggestions = pickSuggestions(rawSuggestions, facets, stats);

    // Remember the state at the moment an editor opens so Discard can restore it.
    const openEditor = (idx) => {
        editBaseline.current = { facets: JSON.stringify(facets), dirty };
        setSelectedIdx(idx);
        setFacetsScreen('editor');
        setView('facets');
    };

    const closeEditor = () => {
        setFacetsScreen('list');
    };

    const discardEdits = () => {
        const base = editBaseline.current;
        if (!base) return;
        const restored = JSON.parse(base.facets);
        setFacets(restored);
        setDirty(base.dirty);
        if (selectedIdx === null || selectedIdx >= restored.length) {
            setSelectedIdx(null);
            setFacetsScreen('list');
        }
    };

    const addFacet = () => {
        editBaseline.current = { facets: JSON.stringify(facets), dirty };
        setFacets([...facets, blankFacet(defaultPostType(stats))]);
        setSelectedIdx(facets.length);
        setDirty(true);
        setFacetsScreen('editor');
        setView('facets');
    };

    const addSuggestion = (suggested) => {
        editBaseline.current = { facets: JSON.stringify(facets), dirty };
        setFacets([...facets, suggested]);
        setSelectedIdx(facets.length);
        setDirty(true);
        setFacetsScreen('editor');
        setView('facets');
    };

    // Pull suggested facet configs from a source integration's /suggest route
    // and append the net-new ones. Shared by every source button below.
    const addSuggestedFacets = async (endpoint, missingMsg, emptyMsg) => {
        const restUrl = bootstrap?.restUrl || '';
        const nonce   = bootstrap?.nonce || '';
        try {
            const res  = await fetch(`${restUrl}${endpoint}`, {
                headers: { 'X-WP-Nonce': nonce },
            });
            const data = await res.json();
            if (!data?.available) {
                alert(data?.reason || missingMsg);
                return;
            }
            const suggested = Array.isArray(data.facets) ? data.facets : [];
            if (suggested.length === 0) {
                alert(emptyMsg);
                return;
            }
            setFacets((prev) => [...prev, ...suggested]);
            setDirty(true);
            setFacetsScreen('list');
            setView('facets');
        } catch (e) {
            alert('Could not fetch suggestions: ' + (e?.message || 'unknown'));
        }
    };

    const addWooCommerceFacets = () => addSuggestedFacets(
        'integrations/woocommerce/suggest',
        'WooCommerce not detected on this site.',
        'No new WooCommerce facets to add — your existing facets already cover the store.',
    );

    const addAcfFacets = () => addSuggestedFacets(
        'integrations/acf/suggest',
        'Advanced Custom Fields not detected on this site.',
        'No new ACF facets to add — your existing facets already cover the indexable fields.',
    );

    const addMetaBoxFacets = () => addSuggestedFacets(
        'integrations/metabox/suggest',
        'Meta Box not detected on this site.',
        'No new Meta Box facets to add — your existing facets already cover the fields.',
    );

    const addPodsFacets = () => addSuggestedFacets(
        'integrations/pods/suggest',
        'Pods not detected on this site.',
        'No new Pods facets to add — your existing facets already cover the fields.',
    );

    const deleteSelected = () => {
        if (selectedIdx === null) return;
        deleteAt(selectedIdx);
    };

    const deleteAt = (idx) => {
        const f = facets[idx];
        if (!f) return;
        if (!window.confirm(`Delete facet "${f.label || f.name || '(unnamed)'}"?`)) return;
        const next = facets.filter((_, i) => i !== idx);
        setFacets(next);
        if (selectedIdx === idx) {
            setSelectedIdx(null);
            setFacetsScreen('list');
        } else if (selectedIdx !== null && idx < selectedIdx) {
            setSelectedIdx(selectedIdx - 1);
        }
        setDirty(true);
    };

    const duplicateAt = (idx) => {
        const src = facets[idx];
        if (!src) return;
        const baseName = src.name || 'facet';
        let candidate  = `${baseName}-copy`;
        const taken    = new Set(facets.map((f) => f.name));
        let n = 2;
        while (taken.has(candidate)) {
            candidate = `${baseName}-copy-${n++}`;
        }
        const clone = {
            ...src,
            name:  candidate,
            label: src.label ? `${src.label} (copy)` : '',
            // Deep-clone the settings object so editing the copy doesn't
            // mutate the source.
            settings: src.settings && typeof src.settings === 'object'
                ? JSON.parse(JSON.stringify(src.settings))
                : {},
        };
        const next = [...facets.slice(0, idx + 1), clone, ...facets.slice(idx + 1)];
        setFacets(next);
        setDirty(true);
    };

    const reorder = (fromIdx, toIdx) => {
        if (fromIdx === toIdx) return;
        const next = [...facets];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        setFacets(next);
        // Keep the selected facet selected by tracking its new index.
        if (selectedIdx === fromIdx) {
            setSelectedIdx(toIdx);
        } else if (selectedIdx !== null) {
            // Selection drifted because the moved row passed over it.
            const lo = Math.min(fromIdx, toIdx);
            const hi = Math.max(fromIdx, toIdx);
            if (selectedIdx >= lo && selectedIdx <= hi) {
                if (fromIdx < toIdx) setSelectedIdx(selectedIdx - 1);
                else                  setSelectedIdx(selectedIdx + 1);
            }
        }
        setDirty(true);
    };

    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            const result = await saveFacets(facets);
            setFacets(Array.isArray(result.facets) ? result.facets : []);
            setDirty(false);
            if (result.reindex === 'needed') setReindexNeeded(true);
            refreshStats();
        } catch (e) {
            setError(e?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    // Rebuilding truncates the live index, so it only ever starts from here.
    const reindexNow = async () => {
        setReindexing(true);
        setError(null);
        try {
            await reindex();
            setReindexNeeded(false);
            refreshStats();
        } catch (e) {
            setError(e?.message || 'Reindex failed');
        } finally {
            setReindexing(false);
        }
    };

    // Sync from the Blueprint sandbox: PUT a settings patch onto one facet
    // without going through the dirty-flag flow that the Facets editor uses.
    const saveFacetSettings = async (facetName, settings) => {
        const next = facets.map((f) =>
            f.name === facetName ? { ...f, settings: { ...settings } } : f
        );
        const result = await saveFacets(next);
        const canonical = Array.isArray(result.facets) ? result.facets : next;
        setFacets(canonical);
        return canonical.find((f) => f.name === facetName) || null;
    };

    const currentView = VIEWS.find((v) => v.id === view) || VIEWS[0];

    return (
        <div className="hof">
            <header className="hof-statusbar">
                <span className="hof-crumb hof-crumb-muted">wp-admin</span>
                <IconChevronRight size={12} stroke={1.75} aria-hidden="true" />
                <span className="hof-crumb">hooked-on-facets</span>
                <IconChevronRight size={12} stroke={1.75} aria-hidden="true" />
                <span className="hof-crumb hof-crumb-active">{currentView.label.toLowerCase()}</span>
                <span className="hof-version">v{bootstrap.version || '0.1.0'}</span>
            </header>

            <div className="hof-layout">
                <aside className="hof-nav">
                    <div className="hof-nav-brand">
                        <svg width="58" height="58" viewBox="0 0 72 72" aria-label="Hooked on Facets">
                            <path d="M36 6 L62 21 L36 36 L10 21 Z" fill="#7F77DD" />
                            <path d="M10 21 L10 51 L36 66 L36 36 Z" fill="#3C3489" />
                            <path d="M62 21 L62 51 L36 66 L36 36 Z" fill="#534AB7" />
                            <circle cx="36" cy="11" r="11" fill="#D85A30" stroke="#F1EFE8" strokeWidth="1.5" />
                        </svg>
                        <span className="hof-nav-wordmark">hooked on facets</span>
                    </div>

                    {SECTION_ORDER.map((section) => (
                        <div key={section} className="hof-nav-section">
                            <p className="hof-nav-section-label">{section}</p>
                            {availableViews.filter((v) => v.section === section).map(({ id, label, Icon }) => (
                                <button
                                    key={id}
                                    type="button"
                                    className={`hof-nav-item ${view === id ? 'is-active' : ''}`}
                                    onClick={() => setView(id)}
                                >
                                    <Icon size={15} stroke={1.5} aria-hidden="true" />
                                    <span>{label}</span>
                                </button>
                            ))}
                        </div>
                    ))}
                </aside>

                <main className="hof-view">
                    {view === 'dashboard' && (
                        <Dashboard
                            facets={facets}
                            productsIndexed={bootstrap.productsIndexed}
                            telemetry={bootstrap.telemetry}
                            onCreateFacet={addFacet}
                            onOpenBlueprint={() => setView('blueprint')}
                        />
                    )}

                    {view === 'facets' && (() => {
                        const invalidCount = countInvalid(facets);
                        const saveLabel = saving
                            ? 'Saving…'
                            : invalidCount > 0
                                ? `Fix ${invalidCount} issue${invalidCount === 1 ? '' : 's'}`
                                : dirty
                                    ? 'Save changes'
                                    : 'Saved';
                        const saveDisabled = saving || !dirty || invalidCount > 0;
                        const inEditor = facetsScreen === 'editor' && selected;
                        return (
                        <div className="hof-view-facets">
                            {inEditor ? (
                                <div className="hof-view-header">
                                    <div className="hof-view-heading">
                                        <button className="hof-btn hof-btn-ghost" onClick={closeEditor} type="button">
                                            <IconArrowLeft size={14} stroke={1.75} aria-hidden="true" /> Facets
                                        </button>
                                    </div>
                                    <div className="hof-view-actions">
                                        {error && <span className="hof-error" role="alert">{error}</span>}
                                        <IndexStatusPill stats={stats} />
                                        <span className={`hof-pill ${dirty ? 'hof-pill-busy' : ''}`}>
                                            <i aria-hidden="true" />{dirty ? 'Unsaved changes' : 'No changes'}
                                        </span>
                                        <button className="hof-btn" onClick={discardEdits} type="button" disabled={!dirty}>
                                            Discard
                                        </button>
                                        <button
                                            className={`hof-btn hof-btn-primary ${invalidCount > 0 ? 'hof-btn-blocked' : ''}`}
                                            disabled={saveDisabled}
                                            onClick={save}
                                            type="button"
                                            title={invalidCount > 0 ? 'Fix the validation issues before saving' : ''}
                                        >
                                            {saving ? 'Saving…' : invalidCount > 0 ? saveLabel : 'Save facet'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="hof-view-header">
                                    <div className="hof-view-heading">
                                        <h2 className="hof-view-title">Facets</h2>
                                        <p className="hof-lede">
                                            Filters and search for any post type. Click one to edit it and watch it work.
                                        </p>
                                    </div>
                                    <div className="hof-view-actions">
                                        <IndexStatusPill stats={stats} />
                                        {bootstrap?.woocommerceActive && (
                                            <button
                                                className="hof-btn"
                                                onClick={addWooCommerceFacets}
                                                type="button"
                                                title="Add suggested facets based on the active WooCommerce store"
                                            >
                                                + WooCommerce facets
                                            </button>
                                        )}
                                        {bootstrap?.acfActive && (
                                            <button
                                                className="hof-btn"
                                                onClick={addAcfFacets}
                                                type="button"
                                                title="Add suggested facets based on your Advanced Custom Fields"
                                            >
                                                + ACF facets
                                            </button>
                                        )}
                                        {bootstrap?.metaboxActive && (
                                            <button
                                                className="hof-btn"
                                                onClick={addMetaBoxFacets}
                                                type="button"
                                                title="Add suggested facets based on your Meta Box fields"
                                            >
                                                + Meta Box facets
                                            </button>
                                        )}
                                        {bootstrap?.podsActive && (
                                            <button
                                                className="hof-btn"
                                                onClick={addPodsFacets}
                                                type="button"
                                                title="Add suggested facets based on your Pods fields"
                                            >
                                                + Pods facets
                                            </button>
                                        )}
                                        {error && <span className="hof-error" role="alert">{error}</span>}
                                        <button
                                            className={`hof-btn ${dirty ? '' : 'hof-btn-primary'}`}
                                            onClick={addFacet}
                                            type="button"
                                        >
                                            New facet
                                        </button>
                                        {dirty && (
                                            <button
                                                className={`hof-btn hof-btn-primary ${invalidCount > 0 ? 'hof-btn-blocked' : ''}`}
                                                disabled={saveDisabled}
                                                onClick={save}
                                                type="button"
                                                title={invalidCount > 0 ? 'Fix the validation issues before saving' : ''}
                                            >
                                                {saveLabel}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {reindexNeeded && (
                                <div className="hof-banner" role="status">
                                    <span>
                                        Saved. New or changed sources aren&apos;t in the index yet, so filters
                                        won&apos;t see them until it&apos;s rebuilt.
                                    </span>
                                    <button
                                        className="hof-btn hof-btn-primary"
                                        type="button"
                                        onClick={reindexNow}
                                        disabled={reindexing}
                                    >
                                        {reindexing ? 'Starting…' : 'Reindex now'}
                                    </button>
                                    <button className="hof-btn hof-btn-ghost" type="button" onClick={() => setReindexNeeded(false)}>
                                        Later
                                    </button>
                                </div>
                            )}

                            {inEditor ? (
                                <section className="hof-facets-content">
                                    <FacetEditor
                                        facet={selected}
                                        onChange={updateSelected}
                                        onDelete={deleteSelected}
                                        allFacets={facets}
                                        availableDisplays={bootstrap.availableDisplays}
                                        postTypes={stats?.post_types || []}
                                        stats={stats}
                                        onOpenTokens={() => setView('tokens')}
                                    />
                                </section>
                            ) : (
                                <FacetsList
                                    facets={facets}
                                    stats={stats}
                                    suggestions={suggestions}
                                    onOpen={openEditor}
                                    onAdd={addFacet}
                                    onAddSuggestion={addSuggestion}
                                    onDuplicate={duplicateAt}
                                    onDelete={deleteAt}
                                    onMove={reorder}
                                />
                            )}
                        </div>
                        );
                    })()}

                    {view === 'tokens' && <TokensPanel tokens={bootstrap.tokens || {}} />}

                    {view === 'blueprint' && (
                        <Blueprint
                            facets={facets}
                            onBack={() => setView('dashboard')}
                            onSaveSettings={saveFacetSettings}
                        />
                    )}

                    {view === 'indexer' && <Indexer />}

                    {view === 'queryloops' && <QueryLoops />}

                    {view === 'seo' && (
                        <SeoSettings bootstrap={bootstrap} />
                    )}

                    {view === 'license' && (
                        <LicenseSettings bootstrap={bootstrap} />
                    )}

                    {view === 'settings' && (
                        bootstrap.proActive ? (
                            <AiSettings bootstrap={bootstrap} />
                        ) : (
                            <div className="hof-panel">
                                <p>
                                    AI settings (the Ask facet) are part of{' '}
                                    <a href="https://hookedonfacets.com/#pricing" target="_blank" rel="noreferrer">
                                        HOF Pro
                                    </a>.
                                </p>
                            </div>
                        )
                    )}
                </main>
            </div>
        </div>
    );
}

function StubView({ label }) {
    return (
        <div className="hof-stub">
            <h2 className="hof-stub-title">{label}</h2>
            <p className="hof-stub-body">
                Coming in a future build. Reach out if you want this prioritized.
            </p>
        </div>
    );
}
