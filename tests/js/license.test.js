import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

vi.mock('../../admin/src/api.js', () => ({ getLicense: vi.fn() }));

import { getLicense } from '../../admin/src/api.js';
import LicenseSettings from '../../admin/src/components/LicenseSettings.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let host;
const urls = { account: '/wp-admin/admin.php?page=hooked-on-facets-account', upgrade: '/wp-admin/admin.php?page=hooked-on-facets-pricing' };
const activate = '/wp-admin/admin.php?page=hooked-on-facets-pro';

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

const buttons = () => [...host.querySelectorAll('.hof-ai-settings-actions a')].map((a) => [a.textContent, a.getAttribute('href')]);
const label = () => host.querySelector('.hof-ai-settings-row-line').textContent;

describe('License screen (Freemius)', () => {
    it('shows an active license with its plan, renewal date and a Manage link', async () => {
        await mount({ configured: true, status: 'active', plan: 'Agency', expires: '2027-10-08', urls });

        expect(label()).toBe('Active');
        expect(host.querySelector('.hof-license-meta').textContent).toMatch(/^Agency plan · Renews .*2027/);
        expect(buttons()).toEqual([['Manage license', urls.account]]);
    });

    it('calls a license with no expiry a lifetime license', async () => {
        await mount({ configured: true, status: 'active', plan: 'Pro', expires: null, urls });

        expect(host.querySelector('.hof-license-meta').textContent).toBe('Pro plan · Lifetime license');
    });

    it('sends an unregistered site to the Freemius license-key form, not the account page', async () => {
        await mount({ configured: true, status: 'not_activated', plan: null, expires: null, urls: { activate, upgrade: urls.upgrade } });

        expect(label()).toBe('Not activated');
        expect(buttons()).toEqual([['Activate license', activate], ['Buy a license', urls.upgrade]]);
        expect(host.querySelector('.hof-ai-settings-actions a').className).toContain('hof-btn-primary');
    });

    it('activates a registered site without a license from its Freemius account page', async () => {
        await mount({ configured: true, status: 'not_activated', plan: null, expires: null, urls });

        expect(buttons()).toEqual([['Activate license', urls.account], ['Buy a license', urls.upgrade]]);
    });

    it('leads an expired license with Renew', async () => {
        await mount({ configured: true, status: 'expired', plan: 'Pro', expires: '2026-01-01', urls });

        expect(buttons()[0]).toEqual(['Renew', urls.upgrade]);
        expect(host.textContent).toContain('updates stop until you renew');
    });

    it('says plainly when the build is not connected to Freemius, with no dead buttons', async () => {
        await mount({ configured: false, status: 'unconfigured', plan: null, expires: null, urls: {} });

        expect(label()).toBe('Licensing isn\'t set up');
        expect(buttons()).toEqual([]);
    });

    it('drops a button whose Freemius URL is missing', async () => {
        await mount({ configured: true, status: 'not_activated', urls: { account: urls.account } });

        expect(buttons()).toEqual([['Activate license', urls.account]]);
    });

    it('offers no key field: activation happens in Freemius', async () => {
        await mount({ configured: true, status: 'not_activated', urls });

        expect(host.querySelector('input')).toBeNull();
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
