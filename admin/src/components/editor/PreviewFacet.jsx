// The facet itself, rendered from real values. Interacting with it calls
// onChange with the next selection, which re-queries the preview.

const nf = new Intl.NumberFormat('en-US');

// Depth-first order so children sit under their parent, the way a real
// hierarchy facet lists them. Terms whose parent isn't in the list are roots.
export function treeOrder(values) {
    const byId = new Map(values.filter((v) => v.term_id != null).map((v) => [v.term_id, v]));
    const kids = new Map();
    const roots = [];
    values.forEach((v) => {
        if (v.parent_id != null && byId.has(v.parent_id)) {
            if (!kids.has(v.parent_id)) kids.set(v.parent_id, []);
            kids.get(v.parent_id).push(v);
        } else {
            roots.push(v);
        }
    });
    const byLabel = (a, b) => a.label.localeCompare(b.label);
    const out = [];
    const walk = (node, depth) => {
        out.push({ ...node, depth });
        (kids.get(node.term_id) || []).sort(byLabel).forEach((k) => walk(k, depth + 1));
    };
    roots.sort(byLabel).forEach((r) => walk(r, 0));
    return out;
}

const toEpoch = (iso) => (iso ? Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / 1000) : null);
const toIso = (epoch) => (epoch == null ? '' : new Date(epoch * 1000).toISOString().slice(0, 10));

export default function PreviewFacet({ facet, values, bounds, selection, onChange }) {
    const label = facet.label || facet.name || 'Facet';
    const display = facet.display;
    const picked = selection.values || [];

    const pick = (value, single) => {
        const on = picked.includes(value);
        if (single) return onChange({ values: on ? [] : [value] });
        return onChange({ values: on ? picked.filter((v) => v !== value) : [...picked, value] });
    };

    let body = null;

    if (display === 'range') {
        const lo = bounds.min ?? 0;
        const hi = bounds.max ?? 0;
        const cur = selection.max ?? hi;
        const step = hi - lo > 20 ? 1 : 0.1;
        body = (
            <>
                <input
                    type="range"
                    min={lo}
                    max={hi}
                    step={step}
                    value={cur}
                    aria-label={`Maximum ${label}`}
                    onChange={(e) => onChange({ max: Number(e.target.value) })}
                />
                <div className="hof-pv-range">
                    <span>{nf.format(lo)}</span>
                    <span>up to {nf.format(cur)}</span>
                </div>
            </>
        );
    } else if (display === 'date_range') {
        body = (
            <div className="hof-pv-dates">
                <input type="date" aria-label={`${label} from`} value={toIso(selection.min)}
                    onChange={(e) => onChange({ min: toEpoch(e.target.value) })} />
                <input type="date" aria-label={`${label} to`} value={toIso(selection.max)}
                    onChange={(e) => onChange({ max: toEpoch(e.target.value) })} />
            </div>
        );
    } else if (display === 'search') {
        body = (
            <input
                type="search"
                className="hof-pv-search"
                placeholder={facet.settings?.placeholder || 'Search'}
                aria-label={label}
                value={selection.q || ''}
                onChange={(e) => onChange({ q: e.target.value })}
            />
        );
    } else if (display === 'toggle') {
        const on = picked.length > 0;
        body = (
            <label className="hof-pv-row">
                <input type="checkbox" checked={on} onChange={() => onChange({ values: on ? [] : ['on'] })} />
                {on ? facet.settings?.on_label || label : facet.settings?.off_label || label}
            </label>
        );
    } else if (display === 'dropdown') {
        body = (
            <select
                className="hof-pv-select"
                aria-label={label}
                value={picked[0] || ''}
                onChange={(e) => onChange({ values: e.target.value ? [e.target.value] : [] })}
            >
                <option value="">Any</option>
                {values.map((v) => (
                    <option key={v.value} value={v.value}>{v.label} ({nf.format(v.count)})</option>
                ))}
            </select>
        );
    } else if (display === 'swatch') {
        body = (
            <div className="hof-pv-swatches">
                {values.map((v) => (
                    <button
                        key={v.value}
                        type="button"
                        className={`hof-pv-swatch ${v.color ? '' : 'is-plain'}`}
                        style={v.color ? { background: v.color } : undefined}
                        aria-pressed={picked.includes(v.value)}
                        aria-label={`${v.label} (${v.count})`}
                        title={`${v.label} (${v.count})`}
                        onClick={() => pick(v.value, false)}
                    />
                ))}
            </div>
        );
    } else {
        // checkbox, radio, hierarchy
        const rows = display === 'hierarchy' ? treeOrder(values) : values;
        const single = display === 'radio';
        body = (
            <div className="hof-pv-list">
                {rows.map((v) => (
                    <label
                        key={v.value}
                        className={`hof-pv-row ${v.count === 0 ? 'is-dim' : ''}`}
                        style={display === 'hierarchy' && v.depth ? { paddingLeft: `${v.depth * 14}px` } : undefined}
                    >
                        <input
                            type={single ? 'radio' : 'checkbox'}
                            name={`hof-pv-${facet.name || 'facet'}`}
                            checked={picked.includes(v.value)}
                            // Radios don't fire change when re-clicked, so clear on click.
                            onClick={single ? () => pick(v.value, true) : undefined}
                            onChange={single ? () => {} : () => pick(v.value, false)}
                        />
                        {v.label}
                        <span className="hof-pv-n">{nf.format(v.count)}</span>
                    </label>
                ))}
            </div>
        );
    }

    return (
        <div className="hof-pv-facet">
            <h3 className="hof-pv-title">{label}</h3>
            {body}
        </div>
    );
}
