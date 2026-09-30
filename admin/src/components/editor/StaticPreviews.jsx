// Static, illustrative previews for displays the admin can't run live
// (signature Pro displays and view-only types). The live-data preview for
// everything else lives in LivePreview.jsx.
export default function StaticPreview({ facet }) {
    const label = facet.label || facet.name || 'Untitled facet';

    if (facet.display === 'range') {
        return (
            <div className="hof-preview">
                <div className="hof-preview-label">{label}</div>
                <div className="hof-preview-range">
                    <input type="range" disabled />
                    <div className="hof-preview-range-bounds">
                        <span>min</span>
                        <span>max</span>
                    </div>
                </div>
                <p className="hof-preview-note">Bounds populate from index data at runtime.</p>
            </div>
        );
    }

    if (facet.display === 'search') {
        return (
            <div className="hof-preview">
                <div className="hof-preview-label">{label}</div>
                <input className="hof-input" type="search" placeholder="Search…" disabled />
                <p className="hof-preview-note">Matches against the configured source field.</p>
            </div>
        );
    }

    if (facet.display === 'swiper') {
        return (
            <div className="hof-preview">
                <div className="hof-preview-label">{label}</div>
                <div className="hof-preview-swiper">
                    <div className="hof-preview-swiper-card hof-preview-swiper-card-back hof-preview-swiper-card-back-2"></div>
                    <div className="hof-preview-swiper-card hof-preview-swiper-card-back hof-preview-swiper-card-back-1"></div>
                    <div className="hof-preview-swiper-card">
                        <p className="hof-preview-swiper-card-meta">{label} · 1 of 12</p>
                        <p className="hof-preview-swiper-card-label">Top card</p>
                    </div>
                </div>
                <div className="hof-preview-swiper-controls">
                    <span className="hof-preview-swiper-btn hof-preview-swiper-btn-skip">←</span>
                    <span className="hof-preview-swiper-btn hof-preview-swiper-btn-include">→</span>
                </div>
                <p className="hof-preview-note">
                    Right = include, left = skip. Cards reuse the term's swatch image/color.
                </p>
            </div>
        );
    }

    if (facet.display === 'spin_the_wheel') {
        return (
            <div className="hof-preview">
                <div className="hof-preview-label">{label}</div>
                <div className="hof-preview-wheel">
                    <span className="hof-preview-wheel-pointer" />
                    <div className="hof-preview-wheel-dial" />
                    <span className="hof-preview-wheel-spin">Spin</span>
                </div>
                <p className="hof-preview-note">
                    Gamified single-select. Spin lands on a value (or pick one directly).
                </p>
            </div>
        );
    }

    if (facet.display === 'saved_bin') {
        return (
            <div className="hof-preview">
                <div className="hof-preview-label">{label}</div>
                <ul className="hof-preview-bin">
                    <li className="hof-preview-bin-item">Trail Runner <span>×</span></li>
                    <li className="hof-preview-bin-item">Court Classic <span>×</span></li>
                </ul>
                <label className="hof-preview-bin-toggle">
                    <input type="checkbox" readOnly /> Show only saved (2)
                </label>
                <p className="hof-preview-note">
                    Shoppers add items (button or drag) into a localStorage bin, then
                    filter results to just the bin. Add buttons via <code>[hof_bin_button]</code>.
                </p>
            </div>
        );
    }

    if (facet.display === 'matrix') {
        const rows = [
            { name: 'Waterproof', weight: 1.0, on: true },
            { name: 'Wireless',   weight: 0.6, on: true },
            { name: 'Foldable',   weight: 0.3, on: false },
        ];
        return (
            <div className="hof-preview">
                <div className="hof-preview-label">{label}</div>
                <ul className="hof-preview-matrix">
                    {rows.map((r) => (
                        <li key={r.name} className={`hof-preview-matrix-row${r.on ? ' is-on' : ''}`}>
                            <span className="hof-preview-matrix-dot" />
                            <span className="hof-preview-matrix-name">{r.name}</span>
                            <span className="hof-preview-matrix-bar" style={{ width: `${r.weight * 100}%` }} />
                        </li>
                    ))}
                </ul>
                <p className="hof-preview-note">
                    Stack values — items must match all selected (AND-within-facet).
                </p>
            </div>
        );
    }

    if (facet.display === 'swatch') {
        // Mock tiles sized by descending fake counts so the preview reads as fluid.
        const swatches = [
            { name: 'Red',    weight: 1.0, color: '#e0364f' },
            { name: 'Blue',   weight: 0.7, color: '#1e40af' },
            { name: 'Green',  weight: 0.4, color: '#16a34a' },
            { name: 'Yellow', weight: 0.2, color: '#facc15' },
        ];
        return (
            <div className="hof-preview">
                <div className="hof-preview-label">{label}</div>
                <div className="hof-preview-swatches">
                    {swatches.map((s) => (
                        <div key={s.name} className="hof-preview-swatch">
                            <span
                                className="hof-preview-swatch-visual"
                                style={{
                                    width:  `${24 + s.weight * 56}px`,
                                    height: `${24 + s.weight * 56}px`,
                                    background: s.color,
                                }}
                            />
                            <span>{s.name}</span>
                        </div>
                    ))}
                </div>
                <p className="hof-preview-note">
                    Tile size morphs by count; image/color comes from per-term meta.
                </p>
            </div>
        );
    }


    if (facet.display === 'visual_dna') {
        const settings = (facet.settings && typeof facet.settings === 'object') ? facet.settings : {};
        const ready = !!settings.target_facet;
        return (
            <div className="hof-preview">
                <div className="hof-preview-label">{label}</div>
                <div className="hof-preview-visual-drop">
                    <span className="hof-preview-visual-icon" aria-hidden="true">⬇</span>
                    <span>Drop · paste URL · 🎨 pick</span>
                </div>
                <div className="hof-preview-visual-result">
                    <span className="hof-preview-visual-swatch" style={{ background: '#c84a2d' }} aria-hidden="true"></span>
                    <span className="hof-preview-visual-readout">
                        <code>#c84a2d</code>
                        <span className="hof-preview-visual-match">
                            <span className="hof-preview-visual-dot" style={{ background: '#f97316' }} aria-hidden="true"></span>
                            orange
                        </span>
                    </span>
                </div>
                <p className="hof-preview-note">
                    {ready
                        ? `Drives the "${settings.target_facet}" facet by snapping to its nearest term in LAB ΔE.`
                        : 'Pick a target color facet to wire this up.'}
                </p>
            </div>
        );
    }

    if (facet.display === 'ask') {
        const settings = (facet.settings && typeof facet.settings === 'object') ? facet.settings : {};
        return (
            <div className="hof-preview">
                <div className="hof-preview-label">{label}</div>
                <div className="hof-preview-ask-input">
                    <span className="hof-preview-ask-icon" aria-hidden="true">✦</span>
                    <span className="hof-preview-ask-placeholder">
                        {settings.placeholder || 'Describe what you\'re looking for…'}
                    </span>
                    <span className="hof-preview-ask-send" aria-hidden="true">▶</span>
                </div>
                <div className="hof-preview-ask-heard">
                    <span className="hof-preview-ask-heard-label">I heard:</span>
                    <span className="hof-preview-ask-chip">color: red <em>×</em></span>
                    <span className="hof-preview-ask-chip">price: ≤50 <em>×</em></span>
                </div>
                <p className="hof-preview-note">
                    Conversational. Each chip is removable — taps update both the filter and the
                    model's next-turn context. Configure the key in Settings → Ask.
                </p>
            </div>
        );
    }

    if (facet.display === 'pagination') {
        const settings = (facet.settings && typeof facet.settings === 'object') ? facet.settings : {};
        const showFL = settings.show_first_last !== false;
        const showPN = settings.show_prev_next !== false;
        return (
            <div className="hof-preview">
                <div className="hof-preview-label">{label}</div>
                <div className="hof-preview-pagination">
                    {showFL && <span className="hof-preview-page">«</span>}
                    {showPN && <span className="hof-preview-page">‹</span>}
                    <span className="hof-preview-page">1</span>
                    <span className="hof-preview-page hof-preview-page-current">2</span>
                    <span className="hof-preview-page">3</span>
                    <span className="hof-preview-page-gap">…</span>
                    <span className="hof-preview-page">12</span>
                    {showPN && <span className="hof-preview-page">›</span>}
                    {showFL && <span className="hof-preview-page">»</span>}
                </div>
                <p className="hof-preview-note">
                    Shows on the live site when results span more than one page. Click a number to
                    jump — filters survive the page change.
                </p>
            </div>
        );
    }

    const stub = ['Option A', 'Option B', 'Option C'];
    return (
        <div className="hof-preview">
            <div className="hof-preview-label">{label}</div>
            <ul className="hof-preview-list">
                {stub.map((v) => (
                    <li key={v}>
                        <label>
                            <input type="checkbox" disabled />
                            <span>{v}</span>
                            <span className="hof-preview-count">(0)</span>
                        </label>
                    </li>
                ))}
            </ul>
            <p className="hof-preview-note">Real options + counts populate once the indexer has run.</p>
        </div>
    );
}
