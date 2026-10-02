import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const load = async (restUrl) => {
    vi.resetModules();
    window.hofAdmin = { restUrl, nonce: 'n' };
    return import('../../admin/src/api.js');
};

describe('api request URLs', () => {
    let fetchMock;

    beforeEach(() => {
        fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        delete window.hofAdmin;
    });

    it('appends the query string with ? on pretty permalinks', async () => {
        const api = await load('https://site.test/wp-json/hof/v1/');
        await api.getSources('product');
        expect(fetchMock.mock.calls[0][0]).toBe('https://site.test/wp-json/hof/v1/sources?post_type=product');
    });

    it('joins the query string with & on plain permalinks', async () => {
        const api = await load('https://site.test/index.php?rest_route=/hof/v1/');
        await api.getSources('post');
        expect(fetchMock.mock.calls[0][0]).toBe(
            'https://site.test/index.php?rest_route=/hof/v1/sources&post_type=post'
        );
    });

    it('leaves paths without a query string alone on plain permalinks', async () => {
        const api = await load('https://site.test/index.php?rest_route=/hof/v1/');
        await api.getPostTypes();
        expect(fetchMock.mock.calls[0][0]).toBe('https://site.test/index.php?rest_route=/hof/v1/post-types');
    });
});
