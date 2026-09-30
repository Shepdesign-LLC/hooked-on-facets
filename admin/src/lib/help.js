// Help drawer content. Pure data and helpers so the copy, the links and the
// search live in one place and unit-test without a browser.

export const DOCS_BASE = 'https://hookedonfacets.com/docs';
export const DOCS_INDEX = `${DOCS_BASE}/`;
export const ISSUES_URL = 'https://github.com/Shepdesign/hooked-on-facets/issues';

export const docUrl = (slug) => `${DOCS_BASE}/${slug}/`;

// What each screen is for, shown in the "On this screen" card. `editor` is the
// Facets screen while one facet is open.
export const HELP_CONTEXT = {
    dashboard: 'Live numbers from the Auto-Hook Engine plus which facets people use and which filters return nothing.',
    facets: 'Click any row to edit, or start from a suggestion under "Found in your content".',
    editor: 'Source first, then type. The preview on the right runs against your indexed content.',
    queryloops: 'Every loop HOF has hooked, with hit counts. If a page isn’t filtering, check it’s listed here.',
    indexer: 'The lookup table behind every filter. Reindex here if counts look wrong after a bulk import.',
    blueprint: 'A sandbox for the visual facets. Nothing changes on the site until you sync or deploy.',
    tokens: 'CSS variables every HOF surface reads. Change one, restyle everything.',
    seo: 'Canonical, noindex and title rules for filtered URLs. Defaults are safe for almost every store.',
    license: 'Your plan, sites and key. Beta program opt-in lives here too.',
    settings: 'Ask provider and key, sources, and which post types get indexed.',
};

// Screen names as the drawer shows them: "Facets list. …", "Query loops. …".
const HELP_TITLE = {
    dashboard: 'Dashboard',
    facets: 'Facets list',
    editor: 'Facet editor',
    queryloops: 'Query loops',
    indexer: 'Indexer',
    blueprint: 'Blueprint',
    tokens: 'Design tokens',
    seo: 'SEO',
    license: 'License',
    settings: 'Settings',
};

/**
 * The card for the current screen. The Facets screen reads as the editor
 * while a facet is open.
 */
export function helpContext(view, facetsScreen = 'list') {
    const key = view === 'facets' && facetsScreen === 'editor' ? 'editor' : view;
    if (!HELP_CONTEXT[key]) return { title: '', text: '' };
    return { title: HELP_TITLE[key], text: HELP_CONTEXT[key] };
}

export const DOC_SECTIONS = [
    {
        title: 'Start here',
        kind: 'Guide',
        links: [
            { slug: 'getting-started', label: 'Your first facet in 3 minutes' },
            { slug: 'post-types', label: 'Filtering a custom post type' },
            { slug: 'search', label: 'Site search that searches fields too' },
            { slug: 'bricks', label: 'Binding a Bricks query loop' },
        ],
    },
    {
        title: 'Reference',
        kind: 'Reference',
        links: [
            { slug: 'facet-types', label: 'All 16 facet types' },
            { slug: 'sources', label: 'Sources: taxonomies, attributes, fields' },
            { slug: 'blueprint', label: 'Blueprint and the visual facets' },
            { slug: 'design-tokens', label: 'Design tokens and theme CSS' },
            { slug: 'seo', label: 'SEO for faceted URLs' },
            { slug: 'ask', label: 'Setting up Ask with your own key' },
            { slug: 'wp-cli', label: 'WP-CLI commands' },
        ],
    },
];

/**
 * Sections narrowed to a search query. Matches the title, the kind tag and
 * the slug, case-insensitively and on every word, so "bricks loop" finds
 * "Binding a Bricks query loop". Sections with no matches drop out.
 */
export function filterDocs(query, sections = DOC_SECTIONS) {
    const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return sections;

    return sections
        .map((section) => ({
            ...section,
            links: section.links.filter((link) => {
                const hay = `${link.label} ${section.kind} ${link.slug}`.toLowerCase();
                return words.every((w) => hay.includes(w));
            }),
        }))
        .filter((section) => section.links.length > 0);
}

export const countLinks = (sections) => sections.reduce((n, s) => n + s.links.length, 0);
