import { SECTION_ORDER } from '../lib/views.js';
import IndexStatusPill from './IndexStatusPill.jsx';

// Brand mark: three isometric planes with a coral spark. Colors come from
// tokens so the mark follows the palette.
function Mark() {
    return (
        <svg className="hof-mark" viewBox="0 0 24 24" role="img" aria-label="hooked on facets">
            <path d="M12 2 21 7.2v9.6L12 22 3 16.8V7.2z" fill="var(--hof-primary)" />
            <path d="M12 2v10l9-4.8z" fill="var(--hof-primary-deep)" />
            <path d="M12 12v10l9-5.2V7.2z" fill="var(--hof-primary-light)" />
            <circle cx="12" cy="3" r="2.6" fill="var(--hof-danger)" />
        </svg>
    );
}

function indexLine(stats, avgMs) {
    const bg = stats?.background;
    if (bg?.running) return `Indexing ${Math.round(bg.percent || 0)}%`;
    if (!stats) return '';
    return typeof avgMs === 'number' ? `Index fresh · ${avgMs.toFixed(1)} ms` : 'Index fresh';
}

/**
 * The app frame inside WordPress's content area: a top bar, and a vertical
 * rail carrying every screen in three groups with a footer showing version,
 * plan and index state. Below 900px the rail becomes a horizontal strip.
 * WordPress's own sidebar and admin bar are left alone.
 */
export default function Shell({ views, view, onNavigate, version, proActive, stats, avgMs, actions = null, children }) {
    const plan = proActive ? 'Pro' : 'Free';
    const line = indexLine(stats, avgMs);

    return (
        <div className="hof">
            <header className="hof-topbar">
                <Mark />
                <span className="hof-wordmark">hooked on facets</span>
                <div className="hof-topbar-right">
                    <IndexStatusPill stats={stats} />
                    <span className={`hof-pill ${proActive ? 'hof-pill-pro' : ''}`}>{plan}</span>
                    {actions}
                </div>
            </header>

            <div className="hof-shell">
                <nav className="hof-rail" aria-label="hooked on facets">
                    {SECTION_ORDER.map((section) => {
                        const items = views.filter((v) => v.section === section);
                        if (items.length === 0) return null;
                        return (
                            <div key={section} className="hof-rail-group" role="group" aria-label={section}>
                                <span className="hof-rail-label" aria-hidden="true">{section}</span>
                                {items.map(({ id, label, Icon }) => (
                                    <button
                                        key={id}
                                        type="button"
                                        className="hof-rail-item"
                                        aria-current={view === id ? 'page' : undefined}
                                        onClick={() => onNavigate(id)}
                                    >
                                        <Icon size={15} stroke={1.6} aria-hidden="true" />
                                        {label}
                                    </button>
                                ))}
                            </div>
                        );
                    })}
                    <div className="hof-rail-foot">
                        <b>v{version || '0.1.0'}</b>
                        {plan}
                        {line && <><br />{line}</>}
                    </div>
                </nav>

                <main className="hof-view">{children}</main>
            </div>
        </div>
    );
}
