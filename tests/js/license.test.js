import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

vi.mock('../../admin/src/api.js', () => ({ getLicense: vi.fn(), activateLicense: vi.fn(), deactivateLicense: vi.fn() }));

import { activateLicense, deactivateLicense, getLicense } from '../../admin/src/api.js';
import LicenseSettings from '../../admin/src/components/LicenseSettings.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let host;

const mount = async (state) => {
    getLicense.mockResolvedValue(state);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root.render(createElement(LicenseSettings)); });
};

afterEach(async () => {
    await act(async () => root?.unmount());
    host?.remove();
    vi.clearAllMocks();
});

const label = () => host.querySelector('.hof-ai-settings-row-line').textContent;

describe('License screen (older Pro)', () => {
    it('asks a site on a Freemius-era Pro to update Pro, with no dead buttons or key field', async () => {
        await mount({ provider: 'freemius', configured: true, status: 'active', plan: 'Pro', expires: null, urls: { account: '/x' } });

        expect(label()).toBe('Update Hooked on Facets Pro');
        expect(host.querySelector('input')).toBeNull();
        expect(host.querySelectorAll('a, button')).toHaveLength(0);
    });

    it('treats a state with no provider the same way', async () => {
        await mount({ configured: false, status: 'unconfigured' });

        expect(label()).toBe('Update Hooked on Facets Pro');
    });

    it('reports a failed load', async () => {
        getLicense.mockRejectedValue(new Error('500'));
        host = document.createElement('div');
        document.body.appendChild(host);
        root = createRoot(host);
        await act(async () => { root.render(createElement(LicenseSettings)); });

        expect(host.querySelector('[role="alert"]').textContent).toBe('Could not load the license state.');
    });
});

describe('License screen (Creem)', () => {
    const base = { provider: 'creem', configured: true, plan: null, urls: { buy: 'https://hookedonfacets.com' } };
    const fresh = { ...base, status: 'not_activated', expires: null, key_hint: null, activations: null, activation_limit: null };
    const active = { ...base, status: 'active', expires: '2027-11-25', key_hint: '…1234', activations: 1, activation_limit: 3 };

    const input = () => host.querySelector('#hof-license-key');
    const type = async (value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        await act(async () => {
            setter.call(input(), value);
            input().dispatchEvent(new Event('input', { bubbles: true }));
        });
    };
    const submit = async () => {
        await act(async () => { host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    };
    const click = async (text) => {
        const btn = [...host.querySelectorAll('button')].find((b) => b.textContent === text);
        await act(async () => { btn.click(); });
    };

    it('asks a fresh site for its key, with a Buy link', async () => {
        await mount(fresh);

        expect(label()).toBe('Not activated');
        expect(input()).not.toBeNull();
        expect(host.querySelector('button[type="submit"]').disabled).toBe(true);
        expect(host.querySelector('a[href="https://hookedonfacets.com"]').textContent).toBe('Buy a license');
        expect(host.textContent).not.toContain('Deactivate on this site');
    });

    it('activates the trimmed key and shows the new state', async () => {
        activateLicense.mockResolvedValue({ ok: true, ...active });
        await mount(fresh);

        await type('  ABCD-1234  ');
        await submit();

        expect(activateLicense).toHaveBeenCalledWith('ABCD-1234');
        expect(label()).toBe('Active');
        expect(host.querySelector('.hof-license-meta').textContent).toMatch(/^Key …1234 · 1 of 3 sites · Renews .*2027/);
        expect(host.querySelector('[role="status"]').textContent).toBe('License activated.');
        expect(input()).toBeNull();
    });

    it("shows the server's reason when a key is rejected and keeps the field", async () => {
        activateLicense.mockResolvedValue({ ok: false, error: 'limit_reached', message: 'This key is already active on as many sites as it allows.', ...fresh, httpStatus: 400 });
        await mount(fresh);

        await type('ABCD-1234');
        await submit();

        expect(host.querySelector('[role="alert"]').textContent).toBe('This key is already active on as many sites as it allows.');
        expect(label()).toBe('Not activated');
        expect(input().value).toBe('ABCD-1234');
    });

    it('reports a network failure without losing the screen', async () => {
        activateLicense.mockRejectedValue(new Error('Failed to fetch'));
        await mount(fresh);

        await type('ABCD-1234');
        await submit();

        expect(host.querySelector('[role="alert"]').textContent).toMatch(/Couldn't reach your site/);
        expect(label()).toBe('Not activated');
    });

    it('lets an active site deactivate, freeing the slot', async () => {
        deactivateLicense.mockResolvedValue({ ok: true, ...fresh });
        await mount(active);

        expect(input()).toBeNull();
        await click('Deactivate on this site');

        expect(deactivateLicense).toHaveBeenCalled();
        expect(label()).toBe('Not activated');
        expect(host.querySelector('[role="status"]').textContent).toMatch(/slot is free/);
    });

    it('re-checks with the server on Check again', async () => {
        getLicense.mockResolvedValueOnce({ ...active, status: 'expired', expires: '2026-11-01' });
        await mount({ ...active, status: 'expired', expires: '2026-11-01' });
        getLicense.mockResolvedValueOnce(active);

        await click('Check again');

        expect(getLicense).toHaveBeenLastCalledWith(true);
        expect(label()).toBe('Active');
    });

    it('lets an expired site enter a different key', async () => {
        await mount({ ...active, status: 'expired', expires: '2026-11-01' });

        expect(label()).toBe('Expired');
        expect(host.querySelector('label[for="hof-license-key"]').textContent).toBe('Enter a different license key');
        expect(host.querySelector('.hof-license-meta').textContent).toMatch(/Expired /);
    });

    it('shows no form when the build has no license server', async () => {
        await mount({ ...fresh, configured: false, status: 'unconfigured', urls: {} });

        expect(label()).toBe('Licensing isn\'t set up');
        expect(input()).toBeNull();
    });
});
