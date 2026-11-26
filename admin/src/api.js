// Thin fetch wrapper around the HOF REST API.
// Reads window.hofAdmin set by the PHP bootstrap (see MenuRegistrar).

const bootstrap = typeof window !== 'undefined' ? window.hofAdmin || {} : {};

// `acceptErrorBody`: on a 4xx/5xx, resolve with the JSON body plus its
// `httpStatus` instead of throwing, for routes whose error body carries a
// message meant for the admin (the license routes).
async function request(path, { acceptErrorBody = false, ...options } = {}) {
    const base = bootstrap.restUrl || '/wp-json/hof/v1/';
    const rel = String(path).replace(/^\//, '');
    // With plain permalinks the base is `…/index.php?rest_route=/hof/v1/`, which
    // already owns the `?`, so a path's own query string has to join with `&`.
    const url = base.includes('?') ? base + rel.replace('?', '&') : base + rel;

    const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {}),
    };
    if (bootstrap.nonce) {
        headers['X-WP-Nonce'] = bootstrap.nonce;
    }

    const res = await fetch(url, { credentials: 'same-origin', ...options, headers });

    if (!res.ok && acceptErrorBody) {
        const body = await res.json().catch(() => null);
        if (body && typeof body === 'object') {
            return { ...body, httpStatus: res.status };
        }
    }

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

// The Pro add-on's license state. Pro 1.4+ reports `provider: 'creem'` with
// { status, expires, key_hint, activations, activation_limit, urls: { buy } }
// and takes the key here. `refresh` asks Pro to re-check with the license
// server first.
export const getLicense = (refresh = false) => request(refresh ? 'license?refresh=1' : 'license');

// Creem only. Both resolve with { ok, error?, message?, ...state }, also on a
// rejected key, so the screen can show the server's explanation.
export const activateLicense = (licenseKey) =>
    request('license', { method: 'POST', body: JSON.stringify({ license_key: licenseKey }), acceptErrorBody: true });

export const deactivateLicense = () => request('license', { method: 'DELETE', acceptErrorBody: true });
