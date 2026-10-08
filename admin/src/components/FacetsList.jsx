import { Fragment } from 'react';
import {
    IconArrowDown,
    IconArrowUp,
    IconAlertTriangle,
    IconCopy,
    IconX,
} from '@tabler/icons-react';
import { validateFacet } from '../validation.js';
import {
    displayLabel,
    facetStatus,
    facetValues,
    groupFacets,
    sourceLabel,
} from '../lib/facets.js';

const STATUS = {
    indexed:  { className: 'hof-pill hof-pill-good', label: 'Indexed' },
    indexing: { className: 'hof-pill hof-pill-busy', label: 'Indexing' },
    pending:  { className: 'hof-pill',               label: 'Not indexed' },
};

const nf = new Intl.NumberFormat('en-US');

export default function FacetsList({
    facets,
    stats,
    suggestions,
    onOpen,
    onAdd,
    onAddSuggestion,
    onDuplicate,
    onDelete,
    onMove,
}) {
    const groups = groupFacets(facets, stats);

    return (
        <div className="hof-facets-list">
            {suggestions.length > 0 && (
                <div className="hof-suggest" role="region" aria-label="Found in your content">
                    <span className="hof-suggest-label">Found in your content</span>
                    <div className="hof-suggest-items">
                        {suggestions.map((s) => (
                            <button
                                key={s.facet.name}
                                type="button"
                                onClick={() => onAddSuggestion(s.facet)}
                            >
                                {s.prefix ? `${s.prefix}: ` : ''}{s.label}{' '}
                                <span>→ {s.display.toLowerCase()}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {facets.length === 0 ? (
                <div className="hof-empty">
                    <p>No facets yet.</p>
                    <button className="hof-btn" onClick={onAdd} type="button">
                        Create your first facet
                    </button>
                </div>
            ) : (
                <div className="hof-table-wrap">
                    <table className="hof-table">
                        <thead>
                            <tr>
                                <th scope="col">Facet</th>
                                <th scope="col">Type</th>
                                <th scope="col">Source</th>
                                <th scope="col" className="hof-num">Values</th>
                                <th scope="col">Status</th>
                                <th scope="col"><span className="hof-sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {groups.map((group) => (
                                <Fragment key={group.key}>
                                    <tr className="hof-table-group">
                                        <td colSpan={6}>
                                            <span className="hof-table-group-name">{group.label}</span>
                                            <span className="hof-table-group-meta">
                                                {' '}· {group.slug || 'no post type'}
                                                {group.items !== null && ` · ${nf.format(group.items)} items`}
                                            </span>
                                        </td>
                                    </tr>
                                    {group.entries.map(({ facet, index }, pos) => (
                                        <FacetRow
                                            key={`${facet.name}-${index}`}
                                            facet={facet}
                                            facets={facets}
                                            stats={stats}
                                            first={pos === 0}
                                            last={pos === group.entries.length - 1}
                                            onOpen={() => onOpen(index)}
                                            onDuplicate={() => onDuplicate(index)}
                                            onDelete={() => onDelete(index)}
                                            onUp={() => onMove(index, group.entries[pos - 1].index)}
                                            onDown={() => onMove(index, group.entries[pos + 1].index)}
                                        />
                                    ))}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <p className="hof-note">
                Grouped by what the facet applies to. Search and Ask work across every post type
                you index, which is why they sit at the top.
            </p>
        </div>
    );
}

function FacetRow({ facet, facets, stats, first, last, onOpen, onDuplicate, onDelete, onUp, onDown }) {
    const issues = validateFacet(facet, facets);
    const invalid = Object.keys(issues).length > 0;
    const issueSummary = Object.values(issues).join(' · ');
    const values = facetValues(facet, stats);
    const status = STATUS[facetStatus(facet, stats)] || STATUS.pending;

    // The whole row opens the editor; the action buttons stop the click so
    // they don't also navigate.
    const stop = (fn) => (e) => {
        e.stopPropagation();
        fn();
    };

    return (
        <tr
            className={`hof-table-row ${invalid ? 'is-invalid' : ''}`}
            onClick={onOpen}
        >
            <td>
                <button
                    type="button"
                    className="hof-row-open"
                    onClick={(e) => { e.stopPropagation(); onOpen(); }}
                >
                    <span className="hof-row-name">{facet.label || facet.name || <em>(unnamed)</em>}</span>
                    <span className="hof-row-slug hof-mono">{facet.name}</span>
                </button>
                {invalid && (
                    <span
                        className="hof-row-invalid"
                        title={issueSummary}
                        aria-label={`Invalid: ${issueSummary}`}
                    >
                        <IconAlertTriangle size={13} stroke={1.75} aria-hidden="true" />
                    </span>
                )}
            </td>
            <td><span className="hof-chip">{displayLabel(facet.display)}</span></td>
            <td>{sourceLabel(facet)}</td>
            <td className="hof-num">{values === null ? '—' : nf.format(values)}</td>
            <td>
                <span className={status.className}><i aria-hidden="true" />{status.label}</span>
            </td>
            <td className="hof-row-actions">
                <button type="button" className="hof-icon-btn" title="Move up" aria-label="Move up"
                    disabled={first} onClick={stop(onUp)}>
                    <IconArrowUp size={13} stroke={1.75} aria-hidden="true" />
                </button>
                <button type="button" className="hof-icon-btn" title="Move down" aria-label="Move down"
                    disabled={last} onClick={stop(onDown)}>
                    <IconArrowDown size={13} stroke={1.75} aria-hidden="true" />
                </button>
                <button type="button" className="hof-icon-btn" title="Duplicate facet" aria-label="Duplicate facet"
                    onClick={stop(onDuplicate)}>
                    <IconCopy size={13} stroke={1.75} aria-hidden="true" />
                </button>
                <button type="button" className="hof-icon-btn hof-icon-btn-danger" title="Delete facet" aria-label="Delete facet"
                    onClick={stop(onDelete)}>
                    <IconX size={13} stroke={1.75} aria-hidden="true" />
                </button>
            </td>
        </tr>
    );
}
