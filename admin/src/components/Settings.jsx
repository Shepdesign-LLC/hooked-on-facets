import { useEffect, useRef, useState } from 'react';
import { getPostTypes, savePostTypes } from '../api.js';
import { fmt } from '../lib/format.js';
import AiSettings from './AiSettings.jsx';
import { Toggle } from './editor/TypeSettings.jsx';

const TABS = [
    { id: 'ask', label: 'Ask' },
    { id: 'sources', label: 'Sources' },
    { id: 'pts', label: 'Post types' },
];

// Tabs with the usual keyboard model: arrows move and select, Home / End jump.
function Tabs({ tab, onChange }) {
    const refs = useRef({});
    const onKey = (e) => {
        const i = TABS.findIndex((t) => t.id === tab);
        let next = null;
        if (e.key === 'ArrowRight') next = TABS[(i + 1) % TABS.length];
        if (e.key === 'ArrowLeft') next = TABS[(i - 1 + TABS.length) % TABS.length];
        if (e.key === 'Home') next = TABS[0];
        if (e.key === 'End') next = TABS[TABS.length - 1];
        if (!next) return;
        e.preventDefault();
        onChange(next.id);
        refs.current[next.id]?.focus();
    };

    return (
        <div className="hof-tabs" role="tablist" aria-label="Settings" onKeyDown={onKey}>
            {TABS.map((t) => (
                <button
                    key={t.id}
                    ref={(el) => { refs.current[t.id] = el; }}
                    id={`hof-tab-${t.id}`}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    aria-controls={`hof-tabpanel-${t.id}`}
                    tabIndex={tab === t.id ? 0 : -1}
                    onClick={() => onChange(t.id)}
                >
                    {t.label}
                </button>
            ))}
        </div>
    );
}

const SOURCES = [
    { key: 'woocommerceActive', name: 'WooCommerce', sub: 'Categories, attributes, price, stock' },
    { key: 'acfActive', name: 'ACF', sub: 'Advanced Custom Fields' },
    { key: 'metaboxActive', name: 'Meta Box', sub: 'Meta Box fields' },
    { key: 'podsActive', name: 'Pods', sub: 'Pods fields' },
];

function Sources({ bootstrap }) {
    return (
        <div className="hof-panel hof-settings-list">
            {SOURCES.map((s) => {
                const on = !!bootstrap[s.key];
                return (
                    <div key={s.key} className="hof-setting-row">
                        <span>
                            {s.name}
                            <small>{on ? s.sub : 'Not installed'}</small>
                        </span>
                        <span className={`hof-pill ${on ? 'hof-pill-good' : ''}`}>
                            <i aria-hidden="true" />{on ? 'Connected' : 'Off'}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

const describe = (row) =>
    [`${fmt(row.items)} item${row.items === 1 ? '' : 's'}`, row.woocommerce ? 'WooCommerce' : row.custom ? 'custom post type' : null]
        .filter(Boolean)
        .join(' · ');

function PostTypes({ onChanged }) {
    const [rows, setRows] = useState(null);
    const [managed, setManaged] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [note, setNote] = useState(null);

    useEffect(() => {
        let live = true;
        getPostTypes()
            .then((res) => {
                if (!live) return;
                setRows(res.post_types || []);
                setManaged(!!res.managed_by_filter);
            })
            .catch((e) => live && setError(e?.message || 'Could not load post types.'));
        return () => { live = false; };
    }, []);

    const toggle = async (row, on) => {
        const indexed = rows.filter((r) => r.indexed && r.slug !== row.slug).map((r) => r.slug);
        if (on) indexed.push(row.slug);

        setSaving(true);
        setError(null);
        setNote(null);
        try {
            const res = await savePostTypes(indexed);
            setRows(res.post_types || []);
            setManaged(!!res.managed_by_filter);
            if (on && res.queued === 'background') {
                setNote(`Indexing ${row.label} in the background. It's under Applies to in the facet editor now.`);
            } else if (on && res.queued === 'manual') {
                setNote(`${row.label} is on. Background jobs aren't available here, so run a reindex from the Indexer.`);
            } else if (on) {
                setNote(`${row.label} is on and available under Applies to.`);
            } else {
                setNote(`${row.label} is off and removed from the index.`);
            }
            onChanged?.();
        } catch (e) {
            // The server refuses (409) while a rebuild is running, and reports why.
            setError(e?.message || 'Could not save.');
        } finally {
            setSaving(false);
        }
    };

    if (error && !rows) return <p className="hof-error" role="alert">{error}</p>;
    if (!rows) return <p className="hof-dash-empty">Loading post types…</p>;

    return (
        <>
            {managed && (
                <p className="hof-note" role="note">
                    A <code>hof_indexed_post_types</code> filter is changing this list, so some changes here may not take effect.
                </p>
            )}
            <div className="hof-panel hof-settings-list">
                {rows.map((row) => (
                    <div key={row.slug} className="hof-setting-row">
                        <span>
                            {row.label}
                            <small>{describe(row)}</small>
                        </span>
                        <Toggle
                            label={`Index ${row.label.toLowerCase()}`}
                            checked={row.indexed}
                            onChange={(on) => toggle(row, on)}
                            disabled={saving}
                        />
                    </div>
                ))}
            </div>
            {error && <p className="hof-error" role="alert">{error}</p>}
            {note && !error && <p className="hof-note" role="status">{note}</p>}
            <p className="hof-note">
                Turning a post type on indexes it in the background and makes it available under Applies to in the
                facet editor.
            </p>
        </>
    );
}

export default function Settings({ bootstrap, onPostTypesChanged }) {
    const [tab, setTab] = useState('ask');

    return (
        <div className="hof-settings">
            <header className="hof-view-header">
                <div className="hof-view-heading">
                    <h2 className="hof-view-title">Settings</h2>
                    <p className="hof-lede">Ask, sources and post types. Nothing here is needed to make your first facet.</p>
                </div>
            </header>

            <Tabs tab={tab} onChange={setTab} />

            <div id={`hof-tabpanel-${tab}`} role="tabpanel" aria-labelledby={`hof-tab-${tab}`} className="hof-tabpanel">
                {tab === 'ask' && (
                    bootstrap.proActive ? (
                        <AiSettings bootstrap={bootstrap} />
                    ) : (
                        <div className="hof-panel hof-settings-upsell">
                            <p>
                                AI settings (the Ask facet) are part of{' '}
                                <a href="https://hookedonfacets.com/#pricing" target="_blank" rel="noreferrer">HOF Pro</a>.
                            </p>
                        </div>
                    )
                )}
                {tab === 'sources' && <Sources bootstrap={bootstrap} />}
                {tab === 'pts' && <PostTypes onChanged={onPostTypesChanged} />}
            </div>
        </div>
    );
}
