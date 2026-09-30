// Thin fetch wrapper around the HOF REST API.
// Reads window.hofAdmin set by the PHP bootstrap (see MenuRegistrar).

const bootstrap = typeof window !== 'undefined' ? window.hofAdmin || {} : {};

async function request(path, options = {}) {
    const base = bootstrap.restUrl || '/wp-json/hof/v1/';
    const url = base + String(path).replace(/^\//, '');

    const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {}),
    };
    if (bootstrap.nonce) {
        headers['X-WP-Nonce'] = bootstrap.nonce;
    }

    const res = await fetch(url, { credentials: 'same-origin', ...options, headers });

    if (!res.ok) {
        let detail = '';
        try {
            const body = await res.json();
            detail = body?.message || JSON.stringify(body);
        } catch {
            detail = await res.text().catch(() => '');
        }
        throw new Error(`${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`);
    }

    return res.json();
}

export const listFacets = () => request('facets');

export const saveFacets = (facets) =>
    request('facets', {
        method: 'PUT',
        body: JSON.stringify({ facets }),
    });

export const reindex = () => request('reindex', { method: 'POST' });

export const getReindexStatus = () => request('reindex/status');

export const getTelemetry = () => request('telemetry');

export const resetTelemetry = () => request('telemetry', { method: 'DELETE' });

export const applyFilter = (filters, page = 1, perPage = 20) =>
    request('filter', {
        method: 'POST',
        body: JSON.stringify({ filters, page, per_page: perPage }),
    });

export const getIndexerStats = () => request('indexer/stats');

// Net-new facet suggestions from one source integration
// (woocommerce | acf | metabox | pods).
export const getSuggestions = (integration) =>
    request(`integrations/${integration}/suggest`);

// What a facet can read from on one post type: taxonomies, integration
// fields and title search, with real counts.
export const getSources = (postType, options = {}) =>
    request(`sources?post_type=${encodeURIComponent(postType)}`, options);

// Run an unsaved facet against live content. `selection` is what the shopper
// has picked in the preview: { values, match, min, max, q }.
export const previewFacet = (facet, selection = {}, options = {}) =>
    request('facets/preview', {
        method: 'POST',
        body: JSON.stringify({ facet, selection }),
        ...options,
    });

// Every public post type with its item count and whether indexing is on.
export const getPostTypes = () => request('post-types');

// Switch indexing on or off. `indexed` is the full list of slugs to index;
// turning one on queues a background index for that type alone.
export const savePostTypes = (indexed) =>
    request('post-types', {
        method: 'PUT',
        body: JSON.stringify({ indexed }),
    });

// Design tokens: values, site CSS and its scope, stored in the hof_tokens option.
export const saveTokens = ({ tokens, custom_css, scope, facet }) =>
    request('tokens', {
        method: 'PUT',
        body: JSON.stringify({ tokens, custom_css, scope, facet }),
    });
