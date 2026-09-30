import { useEffect, useId, useRef, useState } from 'react';
import { DOCS_INDEX, ISSUES_URL, countLinks, docUrl, filterDocs, helpContext } from '../lib/help.js';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Help, in a drawer. Opens from the Help button in the top bar, closes on the
 * close button, a click on the scrim, or Escape. Focus moves to the search box
 * on open, stays inside the drawer while it is open, and returns to the Help
 * button on close. Mounted once by App and told which screen it is on.
 */
export default function HelpDrawer({ open, onClose, view, facetsScreen = 'list', proActive = false, returnFocusRef = null }) {
    const [query, setQuery] = useState('');
    const drawerRef = useRef(null);
    const searchRef = useRef(null);
    const opener = useRef(null);
    const titleId = useId();
    const statusId = useId();

    // Focus the search box on open; on close, hand focus back to the Help
    // button (or whatever had it). The button is passed in because Safari
    // doesn't focus a button on click, so activeElement can't be trusted.
    useEffect(() => {
        if (!open) return undefined;
        opener.current = document.activeElement;
        searchRef.current?.focus();
        return () => {
            const el = returnFocusRef?.current || opener.current;
            if (el && typeof el.focus === 'function' && document.contains(el)) el.focus();
        };
    }, [open, returnFocusRef]);

    // Escape closes; Tab wraps inside the drawer.
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
                return;
            }
            if (e.key !== 'Tab' || !drawerRef.current) return;
            const nodes = Array.from(drawerRef.current.querySelectorAll(FOCUSABLE));
            if (nodes.length === 0) return;
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const ctx = helpContext(view, facetsScreen);
    const sections = filterDocs(query);
    const matches = countLinks(sections);
    const searching = query.trim() !== '';

    return (
        <>
            <div
                className={`hof-scrim ${open ? 'is-open' : ''}`}
                onClick={onClose}
                aria-hidden="true"
                data-testid="hof-help-scrim"
            />
            <aside
                ref={drawerRef}
                className={`hof-drawer ${open ? 'is-open' : ''}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-hidden={open ? undefined : 'true'}
            >
                <div className="hof-drawer-head">
                    <h2 id={titleId}>Help</h2>
                    <button type="button" className="hof-btn hof-btn-ghost hof-btn-sm" onClick={onClose}>
                        Close
                    </button>
                </div>

                <input
                    ref={searchRef}
                    type="search"
                    className="hof-input"
                    placeholder="Search the docs"
                    aria-label="Search the docs"
                    aria-describedby={statusId}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <p id={statusId} className="hof-sr-only" role="status">
                    {searching ? `${matches} ${matches === 1 ? 'result' : 'results'}` : ''}
                </p>

                {ctx.text && (
                    <div className="hof-drawer-ctx">
                        <b>On this screen</b>
                        {ctx.title}. {ctx.text}
                    </div>
                )}

                {sections.map((section) => (
                    <section key={section.title} aria-label={section.title}>
                        <h3 className="hof-drawer-h">{section.title}</h3>
                        {section.links.map((link) => (
                            <a
                                key={link.slug}
                                className="hof-drawer-doc"
                                href={docUrl(link.slug)}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {link.label}
                                <span>{section.kind}</span>
                            </a>
                        ))}
                    </section>
                ))}

                {searching && matches === 0 && (
                    <p className="hof-drawer-none">
                        Nothing matches “{query.trim()}”.{' '}
                        <a href={DOCS_INDEX} target="_blank" rel="noopener noreferrer">Browse all docs</a>
                    </p>
                )}

                <div className="hof-drawer-ask">
                    Stuck? Reply to any HOF email or open a{' '}
                    <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">GitHub issue</a>.
                    {proActive && ' Pro customers get priority email support from the License screen.'}
                </div>
            </aside>
        </>
    );
}
