import { useEffect, useRef, useState } from 'react';

// Three ways to put a facet on a page: shortcode, block, Bricks element.
export default function PlaceIt({ slug }) {
    const shortcode = `[hof_facet name="${slug || 'facet'}"]`;
    const [copied, setCopied] = useState('');
    const timer = useRef(null);

    useEffect(() => () => clearTimeout(timer.current), []);

    const copy = async () => {
        let ok = true;
        try {
            await navigator.clipboard.writeText(shortcode);
        } catch {
            ok = false;
        }
        setCopied(ok ? 'Copied' : 'Select and copy');
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(''), 2000);
    };

    return (
        <section className="hof-place" aria-label="Place it">
            <h2>Place it</h2>
            <div className="hof-place-grid">
                <div className="hof-place-card">
                    <b>Shortcode</b>
                    <code>{shortcode}</code>
                    <button type="button" className="hof-btn hof-btn-sm" onClick={copy}>
                        {copied || 'Copy'}
                    </button>
                    <span className="hof-sr-only" role="status">{copied}</span>
                </div>
                <div className="hof-place-card">
                    <b>Block</b>
                    <code>hof/facet</code>
                    <span className="hof-note">
                        Search &quot;facet&quot; in the block inserter and pick <em>Hooked Facet</em>.
                    </span>
                </div>
                <div className="hof-place-card">
                    <b>Bricks element</b>
                    <code>Hooked Facet</code>
                    <span className="hof-note">
                        Drag it into any template. Tag the query loop with the class <code>hof</code> and it binds.
                    </span>
                </div>
            </div>
        </section>
    );
}
