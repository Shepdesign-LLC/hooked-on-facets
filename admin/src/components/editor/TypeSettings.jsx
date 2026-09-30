import Tip from '../ui/Tip.jsx';

// Type-specific controls, split the way the editor is: Behavior (how the
// facet filters) and Display (what shoppers see). Every setting the previous
// editor exposed is still here.

// Multi-value displays: a shopper can pick more than one value, so any/all
// (OR/AND) matching is meaningful.
const MULTI_VALUE = new Set(['checkbox', 'swatch', 'swiper']);

// Displays that can target a color facet (Visual DNA).
export const COLOR_TARGETS = new Set(['checkbox', 'radio', 'dropdown', 'swatch', 'swiper']);

const MATCH_TIP =
    'Any: show items that have at least one of the picked values. All: show only items that have every picked value. ' +
    'Most stores want Any.';

export function Seg({ value, options, onChange, label }) {
    return (
        <div className="hof-seg" role="group" aria-label={label}>
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    aria-pressed={value === o.value}
                    onClick={() => onChange(o.value)}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export function Toggle({ checked, onChange, label }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            className="hof-switch"
            onClick={() => onChange(!checked)}
        />
    );
}

export function Row({ label, tip, children }) {
    return (
        <div className="hof-row">
            <span>{label}{tip && <Tip text={tip} />}</span>
            {children}
        </div>
    );
}

export function BehaviorFields({ facet, settings, update, issues, colorTargetFacets }) {
    const d = facet.display;
    return (
        <>
            {MULTI_VALUE.has(d) && (
                <Row label="Match" tip={MATCH_TIP}>
                    <Seg
                        label="Match"
                        value={settings.match || 'any'}
                        onChange={(match) => update({ match })}
                        options={[{ value: 'any', label: 'Any' }, { value: 'all', label: 'All' }]}
                    />
                </Row>
            )}

            {d === 'toggle' && (
                <label className="hof-field">
                    <span className="hof-field-label">True value (in the index)</span>
                    <input
                        className="hof-input"
                        type="text"
                        value={settings.true_value || ''}
                        onChange={(e) => update({ true_value: e.target.value })}
                        placeholder="1"
                    />
                    <span className="hof-field-help">
                        The exact <code>facet_value</code> the index stores for matching items. Typically{' '}
                        <code>1</code> for boolean meta, or e.g. <code>yes</code>, <code>true</code>,{' '}
                        <code>instock</code>.
                    </span>
                </label>
            )}

            {d === 'date_range' && (
                <p className="hof-field-help">
                    <strong>Note:</strong> the source meta field must store dates the indexer can read
                    (ISO dates, or ACF&apos;s compact <code>Ymd</code>). They are indexed as Unix timestamps.
                </p>
            )}

            {d === 'visual_dna' && (
                <label className={`hof-field ${issues['settings.target_facet'] ? 'is-invalid' : ''}`}>
                    <span className="hof-field-label">Target color facet</span>
                    <select
                        className="hof-input"
                        value={settings.target_facet || ''}
                        onChange={(e) => update({ target_facet: e.target.value })}
                        aria-invalid={issues['settings.target_facet'] ? 'true' : 'false'}
                    >
                        <option value="">— pick a color facet —</option>
                        {colorTargetFacets.map((f) => (
                            <option key={f.name} value={f.name}>{f.label || f.name} ({f.display})</option>
                        ))}
                    </select>
                    {issues['settings.target_facet']
                        ? <span className="hof-field-error">{issues['settings.target_facet']}</span>
                        : colorTargetFacets.length === 0 && (
                            <span className="hof-field-help hof-field-warn">
                                No color-bearing facets configured. Add a checkbox, dropdown, or swatch facet
                                for a color taxonomy first.
                            </span>
                        )}
                    <span className="hof-field-help">
                        Color terms get their hex from the term&apos;s <code>swatch_color</code> meta (same as
                        the swatch facet uses), falling back to a built-in name table for common terms like{' '}
                        <code>red</code>, <code>navy</code>, <code>olive</code>.
                    </span>
                </label>
            )}

            {d === 'pagination' && (
                <>
                    <label className="hof-field">
                        <span className="hof-field-label">Per page (optional)</span>
                        <input
                            className="hof-input"
                            type="number"
                            min="1"
                            value={settings.per_page || ''}
                            onChange={(e) => {
                                const v = e.target.value === '' ? null : Math.max(1, parseInt(e.target.value, 10) || 1);
                                update({ per_page: v });
                            }}
                            placeholder='Default: WP "Posts per page" setting'
                        />
                        <span className="hof-field-help">
                            Leave blank to use WordPress&apos;s <code>posts_per_page</code> option (Settings → Reading).
                        </span>
                    </label>
                    <label className="hof-field">
                        <span className="hof-field-label">Neighbors visible</span>
                        <input
                            className="hof-input"
                            type="number"
                            min="0"
                            max="5"
                            value={settings.neighbors ?? 2}
                            onChange={(e) => update({ neighbors: Math.max(0, Math.min(5, parseInt(e.target.value, 10) || 0)) })}
                        />
                        <span className="hof-field-help">
                            How many page numbers show on each side of the current page. 2 fits most narrow sidebars.
                        </span>
                    </label>
                    <Row label="Show first/last buttons (« »)">
                        <Toggle
                            label="Show first and last buttons"
                            checked={settings.show_first_last !== false}
                            onChange={(v) => update({ show_first_last: v })}
                        />
                    </Row>
                    <Row label="Show prev/next buttons (‹ ›)">
                        <Toggle
                            label="Show previous and next buttons"
                            checked={settings.show_prev_next !== false}
                            onChange={(v) => update({ show_prev_next: v })}
                        />
                    </Row>
                </>
            )}

            {d === 'swiper' && (
                <p className="hof-field-help">
                    Variant, card size, deck depth and animation are tuned in Blueprint against live
                    products, then synced back here.
                </p>
            )}
        </>
    );
}

export function DisplayFields({ facet, settings, update }) {
    const d = facet.display;
    return (
        <>
            {d === 'ask' && (
                <label className="hof-field">
                    <span className="hof-field-label">Placeholder text</span>
                    <input
                        className="hof-input"
                        type="text"
                        value={settings.placeholder || ''}
                        onChange={(e) => update({ placeholder: e.target.value })}
                        placeholder="Describe what you're looking for…"
                    />
                    <span className="hof-field-help">
                        Shown before the shopper types. Hint what kinds of asks work, e.g.{' '}
                        <em>&quot;comfy red shoes under $50&quot;</em>.
                    </span>
                </label>
            )}

            {d === 'toggle' && (
                <>
                    <label className="hof-field">
                        <span className="hof-field-label">On label (optional)</span>
                        <input
                            className="hof-input"
                            type="text"
                            value={settings.on_label || ''}
                            onChange={(e) => update({ on_label: e.target.value })}
                            placeholder="On"
                        />
                    </label>
                    <label className="hof-field">
                        <span className="hof-field-label">Off label (optional)</span>
                        <input
                            className="hof-input"
                            type="text"
                            value={settings.off_label || ''}
                            onChange={(e) => update({ off_label: e.target.value })}
                            placeholder="Off"
                        />
                    </label>
                </>
            )}

            {d === 'swatch' && facet.kind !== 'taxonomy' && (
                <p className="hof-field-help hof-field-warn">
                    Swatches require a taxonomy source. Falls back to a checkbox list at runtime.
                </p>
            )}
            {d === 'swatch' && facet.kind === 'taxonomy' && (
                <p className="hof-field-help">
                    Set the swatch image and color per term on the Edit term screen for{' '}
                    <code>{facet.source || 'your-taxonomy'}</code>.
                </p>
            )}
        </>
    );
}
