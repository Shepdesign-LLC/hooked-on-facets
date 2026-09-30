import { useState } from 'react';
import { IconAlertCircle, IconCheck, IconRefresh } from '@tabler/icons-react';
import { reindex } from '../api.js';
import { ago, duration, fmt } from '../lib/format.js';
import { isEverywhere } from '../lib/facets.js';

const WP_CLI_ALL = 'wp hof reindex';
const WP_CLI_ONE = 'wp hof reindex --post=123';

// Per-facet status. While a rebuild runs every facet is being rewritten, so
// every facet shows its progress.
function StatusPill({ status, percent }) {
    if (status === 'indexing') {
        return <span className="hof-pill hof-pill-busy"><i aria-hidden="true" />Indexing {Math.round(percent || 0)}%</span>;
    }
    if (status === 'indexed') {
        return <span className="hof-pill hof-pill-good"><i aria-hidden="true" />Fresh</span>;
    }
    return <span className="hof-pill"><i aria-hidden="true" />Not indexed</span>;
}

export default function Indexer({ facets = [], stats = null, onRefresh = () => {} }) {
    const [running, setRunning] = useState(false);   // the request itself
    const [error, setError] = useState(null);
    const [note, setNote] = useState(null);

    const bg = stats?.background || {};
    const rebuilding = running || !!bg.running;
    const loading = stats === null;

    const runReindex = async () => {
        setRunning(true);
        setError(null);
        setNote(null);
        try {
            const result = await reindex();
            if (result?.mode === 'background') {
                setNote('Background job queued. The index rebuilds in chunks; progress shows here.');
            } else if (typeof result?.elapsed === 'number') {
                const n = result.indexed;
                setNote(`Reindexed ${fmt(n)} object${n === 1 ? '' : 's'} in ${duration(result.elapsed)}.`);
            }
            onRefresh();
        } catch (e) {
            setError(e?.message || 'Reindex failed.');
        } finally {
            setRunning(false);
        }
    };

    // "Last full rebuild 2 h ago · 19.4 s", from the job state the server keeps.
    let statePill;
    if (bg.running) {
        statePill = <span className="hof-pill hof-pill-busy"><i aria-hidden="true" />Rebuilding · {Math.round(bg.percent || 0)}%</span>;
    } else if (bg.finished_at) {
        const took = bg.started_at ? duration(bg.finished_at - bg.started_at) : '';
        statePill = (
            <span className="hof-pill hof-pill-good">
                <i aria-hidden="true" />Last full rebuild {ago(bg.finished_at)}{took ? ` · ${took}` : ''}
            </span>
        );
    }

    const postTypes = stats?.post_types || [];
    const labelFor = (slug) => postTypes.find((p) => p.slug === slug)?.label || slug || '—';
    const rows = facets
        .filter((f) => f.name && stats?.facets?.[f.name])
        .map((f) => ({ facet: f, s: stats.facets[f.name] }));
    const inIndex = rows.filter((r) => r.s.rows > 0).length;

    return (
        <div className="hof-indexer">
            <header className="hof-view-header">
                <div className="hof-view-heading">
                    <h2 className="hof-view-title">Indexer</h2>
                    <p className="hof-lede">
                        The lookup table behind every filter: a flat table that powers sub-50ms multi-facet filtering.
                        Rebuilds run in the background; editing content updates it incrementally on
                        <code> save_post</code> and <code> set_object_terms</code>. Run a full rebuild after changing
                        a facet&apos;s source or bulk-importing content.
                    </p>
                </div>
                <div className="hof-view-actions">
                    {statePill}
                    <button
                        type="button"
                        className="hof-btn hof-btn-primary"
                        onClick={runReindex}
                        disabled={rebuilding}
                    >
                        <IconRefresh size={15} stroke={2} aria-hidden="true" className={rebuilding ? 'hof-spin' : ''} />
                        {rebuilding ? 'Rebuilding…' : 'Reindex now'}
                    </button>
                </div>
            </header>

            {error && (
                <div className="hof-indexer-error" role="alert">
                    <IconAlertCircle size={16} stroke={1.75} aria-hidden="true" />
                    <span>{error}</span>
                </div>
            )}

            {note && !error && (
                <div className="hof-indexer-toast" role="status">
                    <IconCheck size={16} stroke={1.75} aria-hidden="true" />
                    <span>{note}</span>
                </div>
            )}

            <div className="hof-dash-stats">
                <Stat label="Index rows" value={loading ? '—' : fmt(stats.totals?.rows)} />
                <Stat label="Distinct objects" value={loading ? '—' : fmt(stats.totals?.objects)} />
                <Stat label="Facets in index" value={loading ? '—' : fmt(inIndex)} />
                <Stat
                    label="Post types"
                    value={loading
                        ? '—'
                        : <>{fmt(postTypes.length)}<span className="hof-stat-unit"> of {fmt(stats.registered_post_types)}</span></>}
                />
            </div>

            <h3 className="hof-dash-section-label">Per-facet breakdown</h3>

            {loading ? (
                <p className="hof-dash-empty">Loading index stats…</p>
            ) : rows.length === 0 ? (
                <p className="hof-dash-empty">
                    Index is empty. Configure facets first, then run a reindex to populate.
                </p>
            ) : (
                <div className="hof-table-wrap">
                    <table className="hof-table">
                        <thead>
                            <tr>
                                <th scope="col">Facet</th>
                                <th scope="col">Post type</th>
                                <th scope="col" className="hof-num">Rows</th>
                                <th scope="col" className="hof-num">Objects</th>
                                <th scope="col">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(({ facet, s }) => (
                                <tr key={facet.name}>
                                    <td>{facet.label || facet.name}</td>
                                    <td>{isEverywhere(facet) ? 'All' : labelFor(s.post_type)}</td>
                                    <td className="hof-num">{s.rows > 0 ? fmt(s.rows) : '—'}</td>
                                    <td className="hof-num">{s.objects > 0 ? fmt(s.objects) : '—'}</td>
                                    <td><StatusPill status={s.status} percent={bg.percent} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <p className="hof-note">
                WP-CLI: <code>{WP_CLI_ALL}</code> for everything, <code>{WP_CLI_ONE}</code> for one item.
            </p>
        </div>
    );
}

function Stat({ label, value }) {
    return (
        <div className="hof-stat">
            <p className="hof-eyebrow">{label}</p>
            <p className="hof-stat-value">{value}</p>
        </div>
    );
}
