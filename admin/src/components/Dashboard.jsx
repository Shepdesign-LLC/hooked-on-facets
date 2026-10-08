import {
    IconArrowRight,
    IconArrowsShuffle,
    IconBookmark,
    IconCalendar,
    IconCircleDot,
    IconCirclesRelation,
    IconFilter,
    IconHierarchy2,
    IconMessageChatbot,
    IconPalette,
    IconPlus,
    IconRotateClockwise2,
    IconRuler2,
    IconSearch,
    IconSelector,
    IconSparkles,
    IconTarget,
    IconToggleLeft,
} from '@tabler/icons-react';
import { displayLabel } from '../lib/facets.js';
import Tip from './ui/Tip.jsx';

const AVG_TIP =
    'How long the index takes to answer a filter, measured on this site. Under 50 ms means a filter change feels instant.';

const ZERO_TIP =
    "Combinations shoppers tried that returned zero results. Each one is a product you don't stock, a value that's " +
    'mis-tagged, or a facet that could hide values with no results.';

const FACET_ICONS = {
    checkbox:       IconFilter,
    radio:          IconCircleDot,
    dropdown:       IconSelector,
    hierarchy:      IconHierarchy2,
    range:          IconRuler2,
    date_range:     IconCalendar,
    toggle:         IconToggleLeft,
    search:         IconSearch,
    swatch:         IconTarget,
    swiper:         IconArrowsShuffle,
    spin_the_wheel: IconRotateClockwise2,
    matrix:         IconCirclesRelation,
    saved_bin:      IconBookmark,
    ask:            IconMessageChatbot,
    visual_dna:     IconPalette,
};

const isLive = (f) => !!(f.name && f.source);
const plural = (n, word) => `${word}${n === 1 ? '' : 's'}`;

export default function Dashboard({ facets, productsIndexed, telemetry, onCreateFacet, onOpenBlueprint, onOpenFacets }) {
    const total       = facets.length;
    const live        = facets.filter(isLive).length;
    const hookedLoops = telemetry?.loops?.count ?? 0;
    const totalHits   = telemetry?.loops?.total_hits ?? 0;
    const avgMs       = telemetry?.resolver?.avg_ms;
    const sampleSize  = telemetry?.resolver?.sample_size ?? 0;
    const resolver    = telemetry?.resolver ?? {};
    const analytics   = telemetry?.facets ?? { usage: [], top_values: {}, zero_results: [], total: 0 };

    return (
        <div className="hof-dash">
            <section className="hof-dash-hero">
                <div className="hof-dash-hero-text">
                    <p className="hof-eyebrow">
                        <span className="hof-live-dot" aria-hidden="true"></span>
                        <span>{hookedLoops > 0 ? 'Live on your store' : 'Ready'}</span>
                    </p>
                    <h1 className="hof-dash-headline">
                        {hookedLoops > 0
                            ? `Filtering ${hookedLoops} product ${plural(hookedLoops, 'list')} on your store.`
                            : 'Add a facet and it shows up on your store.'}
                    </h1>
                    <p className="hof-dash-sub">
                        {hookedLoops > 0
                            ? `${fmtNumber(totalHits)} filtered page ${plural(totalHits, 'view')} so far. New facets connect automatically.`
                            : 'Facets connect to your shop pages on their own. No shortcodes, no template edits.'}
                    </p>
                </div>
                <div className="hof-dash-actions">
                    <button type="button" className="hof-btn hof-btn-primary" onClick={onCreateFacet}>
                        <IconPlus size={16} stroke={2} aria-hidden="true" />
                        New facet
                    </button>
                    <button type="button" className="hof-btn" onClick={onOpenBlueprint}>
                        <IconSparkles size={16} stroke={1.75} aria-hidden="true" />
                        Open playground
                    </button>
                </div>
            </section>

            <div className="hof-dash-stats">
                <Stat
                    label={sampleSize > 0 ? `Filter speed · last ${sampleSize}` : 'Filter speed'}
                    tip={AVG_TIP}
                    value={msStat(avgMs)}
                />
                <Stat label="Products indexed" value={fmtNumber(productsIndexed)} />
                <Stat
                    label="Live facets"
                    value={<><span>{live}</span>{live < total && <span className="hof-stat-unit">of {total}</span>}</>}
                />
            </div>

            <Analytics analytics={analytics} resolver={resolver} facets={facets} />

            <div className="hof-dash-section-head">
                <h2 className="hof-dash-section-label">Your facets</h2>
                {total > 0 && onOpenFacets && (
                    <button type="button" className="hof-btn hof-btn-ghost hof-btn-sm" onClick={onOpenFacets}>
                        Manage <IconArrowRight size={14} stroke={1.75} aria-hidden="true" />
                    </button>
                )}
            </div>

            {total === 0 ? (
                <p className="hof-dash-empty">No facets yet. Create one and it appears on your shop pages.</p>
            ) : (
                <ul className="hof-dash-facets">
                    {facets.map((f, i) => {
                        const Icon = FACET_ICONS[f.display] || IconFilter;
                        const ready = isLive(f);
                        return (
                            <li key={i} className="hof-dash-facet" data-hof-draft={ready ? undefined : '1'}>
                                <span className="hof-dash-facet-icon" aria-hidden="true">
                                    <Icon size={18} stroke={1.5} />
                                </span>
                                <div className="hof-dash-facet-text">
                                    <p className="hof-dash-facet-name">{f.label || f.name || 'Untitled'}</p>
                                    <p className="hof-dash-facet-source">{f.source || 'No source picked yet'}</p>
                                </div>
                                <span className="hof-chip">{displayLabel(f.display)}</span>
                                {ready
                                    ? <span className="hof-pill hof-pill-good"><i aria-hidden="true" />Live</span>
                                    : <span className="hof-pill"><i aria-hidden="true" />Draft</span>}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

function Stat({ label, tip, value }) {
    return (
        <div className="hof-stat">
            <p className="hof-eyebrow">{label}{tip && <Tip text={tip} />}</p>
            <p className="hof-stat-value">{value}</p>
        </div>
    );
}

// Usage analytics from the telemetry snapshot: facet/value popularity,
// zero-result combos, latency percentiles, and unused facets. Nothing here
// renders until there is something real to show.
function Analytics({ analytics, resolver, facets }) {
    const usage = analytics.usage || [];
    const zero  = analytics.zero_results || [];
    const hasData = usage.length > 0 || zero.length > 0;

    // Unused facets — configured but never applied by a shopper. Only
    // meaningful once shoppers have used *something*; before that every
    // facet would be flagged.
    const usedNames = new Set(usage.map((u) => u.facet));
    const dead = hasData
        ? facets.filter((f) => isLive(f) && !usedNames.has(f.name)).map((f) => f.label || f.name)
        : [];

    const speed = [
        ['Typical (p50)', resolver.p50_ms],
        ['Slow (p95)', resolver.p95_ms],
        ['Slowest (p99)', resolver.p99_ms],
    ].filter(([, ms]) => ms !== null && ms !== undefined);

    const maxUsage = usage.reduce((m, u) => Math.max(m, u.count), 0) || 1;

    return (
        <>
            <h2 className="hof-dash-section-label">Shopper activity</h2>

            {speed.length > 0 && (
                <div className="hof-dash-stats">
                    {speed.map(([label, ms]) => <Stat key={label} label={label} value={msStat(ms)} />)}
                </div>
            )}

            {!hasData ? (
                <p className="hof-dash-empty">
                    Nothing yet. As shoppers use your filters, you&apos;ll see what they reach for here.
                </p>
            ) : (
                <div className="hof-analytics-grid">
                    <section className="hof-analytics-card">
                        <h3 className="hof-analytics-title">Most-used facets</h3>
                        {usage.length === 0 ? (
                            <p className="hof-analytics-muted">No facet usage yet.</p>
                        ) : (
                            <ul className="hof-analytics-bars">
                                {usage.slice(0, 8).map((u) => (
                                    <li key={u.facet} className="hof-analytics-bar-row">
                                        <span className="hof-analytics-bar-label">{u.facet}</span>
                                        <span className="hof-analytics-bar-track">
                                            <span
                                                className="hof-analytics-bar-fill"
                                                style={{ width: `${Math.round((u.count / maxUsage) * 100)}%` }}
                                            />
                                        </span>
                                        <span className="hof-analytics-bar-count">{fmtNumber(u.count)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section className="hof-analytics-card">
                        <h3 className="hof-analytics-title">Filters that find nothing<Tip text={ZERO_TIP} /></h3>
                        {zero.length === 0 ? (
                            <p className="hof-analytics-muted">No zero-result filters — nice.</p>
                        ) : (
                            <ul className="hof-analytics-list">
                                {zero.slice(0, 8).map((z) => (
                                    <li key={z.signature} className="hof-analytics-list-row">
                                        <code className="hof-analytics-sig">{z.signature}</code>
                                        <span className="hof-chip">{fmtNumber(z.count)}×</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            )}

            {dead.length > 0 && (
                <p className="hof-analytics-dead">
                    <strong>{dead.length} {plural(dead.length, 'facet')} not used yet:</strong>{' '}
                    {dead.slice(0, 6).join(', ')}{dead.length > 6 ? '…' : ''}. Try moving{' '}
                    {dead.length === 1 ? 'it' : 'them'} higher on the page, or remove {dead.length === 1 ? 'it' : 'them'}.
                </p>
            )}
        </>
    );
}

function msStat(ms) {
    return ms !== null && ms !== undefined
        ? <><span>{Number(ms).toFixed(1)}</span><span className="hof-stat-unit">ms</span></>
        : <span>—</span>;
}

function fmtNumber(n) {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
    return n.toLocaleString();
}
