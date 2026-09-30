import { useEffect, useState } from 'react';
import { IconRotate, IconTrash } from '@tabler/icons-react';
import { getTelemetry, resetTelemetry } from '../api.js';
import Tip from './ui/Tip.jsx';
import { ago, fmt } from '../lib/format.js';

const INTERCEPT_TIP =
    "How HOF found the loop. Main query, archive, taxonomy, search and home are the page's own query, which includes " +
    'a Gutenberg Query Loop on a block theme. Bricks class means a query loop element tagged hof. Elementor means a ' +
    'widget with Query ID hof. Opt-in means a block or shortcode targeted it.';

// Label for each intercept type. Kept aligned with the signature scheme
// QueryHook::loop_signature() and the page-builder integrations emit.
const TYPE_LABEL = {
    archive:    'Post type archive',
    tax:        'Taxonomy',
    search:     'Search',
    home:       'Home',
    main:       'Main query',
    opt_in:     'Opt-in (block / shortcode)',
    bricks:     'Bricks class: hof',
    elementor:  'Elementor Query ID: hof',
    breakdance: 'Breakdance Array Query',
    divi:       'Divi module',
    unknown:    'Unknown',
};

export default function QueryLoops() {
    const [telemetry, setTelemetry] = useState(null);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState(null);
    const [resetting, setResetting] = useState(false);

    const reload = () => {
        setLoading(true);
        return getTelemetry()
            .then(setTelemetry)
            .catch((e) => setError(e.message || 'Failed to load telemetry.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { reload(); }, []);

    const reset = async () => {
        if (!window.confirm('Reset all hooked-loop counters? This clears the avg query time samples too.')) return;
        setResetting(true);
        setError(null);
        try {
            const fresh = await resetTelemetry();
            setTelemetry(fresh);
        } catch (e) {
            setError(e.message || 'Reset failed.');
        } finally {
            setResetting(false);
        }
    };

    const signatures = telemetry?.loops?.signatures || [];
    const distinct   = telemetry?.loops?.count ?? 0;
    const totalHits  = telemetry?.loops?.total_hits ?? 0;
    const avgMs      = telemetry?.resolver?.avg_ms;

    return (
        <div className="hof-loops">
            <header className="hof-view-header">
                <h2 className="hof-view-title">Query loops</h2>
                <div className="hof-view-actions">
                    <button
                        type="button"
                        className="hof-btn"
                        onClick={reload}
                        disabled={loading || resetting}
                        title="Reload"
                    >
                        <IconRotate size={14} stroke={1.75} aria-hidden="true" className={loading ? 'hof-spin' : ''} />
                        Reload
                    </button>
                    <button
                        type="button"
                        className="hof-btn hof-btn-danger"
                        onClick={reset}
                        disabled={resetting || distinct === 0}
                    >
                        <IconTrash size={14} stroke={1.75} aria-hidden="true" />
                        {resetting ? 'Resetting…' : 'Reset counters'}
                    </button>
                </div>
            </header>

            <p className="hof-indexer-blurb">
                Every WP_Query loop the Auto-Hook Engine intercepts is captured here by intercept type and post type.
                Counts increment on every server-rendered page that the engine binds — visit a shop archive with
                <code> ?hof[…]=…</code> params to populate this list.
            </p>

            {error && (
                <div className="hof-indexer-error" role="alert">
                    <span>{error}</span>
                </div>
            )}

            <div className="hof-dash-stats">
                <Stat label="Distinct loops"  value={fmt(distinct)} />
                <Stat label="Total intercepts" value={fmt(totalHits)} />
                <Stat
                    label="Avg query time"
                    value={
                        avgMs !== null && avgMs !== undefined
                            ? <><span>{avgMs.toFixed(1)}</span><span className="hof-stat-unit">ms</span></>
                            : <><span>—</span><span className="hof-stat-unit">ms</span></>
                    }
                />
            </div>

            <p className="hof-eyebrow hof-dash-section-label">Hooked loops</p>

            {loading && signatures.length === 0 ? (
                <p className="hof-dash-empty">Loading telemetry…</p>
            ) : signatures.length === 0 ? (
                <p className="hof-dash-empty">
                    No intercepts captured yet. The engine records a loop the first time it binds facets to a query.
                </p>
            ) : (
                <div className="hof-table-wrap">
                    <table className="hof-table">
                        <thead>
                            <tr>
                                <th scope="col">Loop</th>
                                <th scope="col">Intercept<Tip text={INTERCEPT_TIP} /></th>
                                <th scope="col">Post type</th>
                                <th scope="col">Last seen</th>
                                <th scope="col" className="hof-num">Hits</th>
                            </tr>
                        </thead>
                        <tbody>
                            {signatures.map((s) => (
                                <tr key={s.signature}>
                                    <td><code className="hof-loops-sig">{s.signature}</code></td>
                                    <td><span className="hof-chip">{TYPE_LABEL[s.type] || TYPE_LABEL.unknown}</span></td>
                                    <td><code>{s.post_type}</code></td>
                                    <td>{s.last ? ago(s.last) : '—'}</td>
                                    <td className="hof-num">{fmt(s.count)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
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
