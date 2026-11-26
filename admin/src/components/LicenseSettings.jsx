import { useEffect, useState } from 'react';
import { IconAlertTriangle, IconCheck, IconKey } from '@tabler/icons-react';
import { activateLicense, deactivateLicense, getLicense } from '../api.js';

// Pro reports which licensing it uses. Pro 1.4+ uses Creem: the admin enters
// the key from their receipt here and Pro activates it through the license
// server. Pro 1.3 used Freemius, which activates in its own screens, so for
// it this screen only reports the state and links there.

const formatDate = (iso) => {
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime())
        ? iso
        : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

function Shell({ sub, children }) {
    return (
        <div className="hof-ai-settings" id="license">
            <header className="hof-ai-settings-header">
                <span className="hof-ai-settings-icon"><IconKey size={20} stroke={1.75} /></span>
                <div>
                    <h2 className="hof-ai-settings-title">License</h2>
                    <p className="hof-ai-settings-sub">{sub}</p>
                </div>
            </header>
            <section className="hof-ai-settings-section">
                <h3 className="hof-ai-settings-section-title">Current status</h3>
                {children}
            </section>
        </div>
    );
}

function StatusRow({ status, tone, label, meta, detail }) {
    const StatusIcon = tone === 'ok' ? IconCheck : IconAlertTriangle;
    return (
        <div className={`hof-ai-settings-row hof-ai-settings-row--${tone}`} data-status={status}>
            <span className="hof-ai-settings-row-icon">
                <StatusIcon size={16} stroke={2} aria-hidden="true" />
            </span>
            <div>
                <p className="hof-ai-settings-row-line"><strong>{label}</strong></p>
                {meta && <p className="hof-ai-settings-row-sub hof-license-meta">{meta}</p>}
                <p className="hof-ai-settings-row-sub">{detail}</p>
            </div>
        </div>
    );
}

// --- Creem (Pro 1.4+) -------------------------------------------------------

const CREEM_STATUS = {
    active:        { tone: 'ok',   label: 'Active' },
    expired:       { tone: 'warn', label: 'Expired' },
    disabled:      { tone: 'warn', label: 'Disabled' },
    invalid:       { tone: 'warn', label: 'Key not recognized' },
    not_activated: { tone: 'warn', label: 'Not activated' },
    unconfigured:  { tone: 'warn', label: 'Licensing isn\'t set up' },
};

const CREEM_DETAIL = {
    active:        'Pro is licensed on this site. Updates arrive on the WordPress Updates screen.',
    expired:       'Your license has expired. Pro keeps working, but updates stop until you renew. After renewing, click Check again.',
    disabled:      'This license has been disabled. Contact support if you think that\'s a mistake.',
    invalid:       'The saved key isn\'t valid for Hooked on Facets Pro. Enter the key from your receipt email.',
    not_activated: 'Enter the license key from your receipt email to get automatic updates for Pro.',
    unconfigured:  'This build has no license server set, so Pro runs without license checks or automatic updates.',
};

function creemMeta(state, status) {
    const parts = [];
    if (state.key_hint) parts.push(`Key ${state.key_hint}`);
    if (state.activation_limit) parts.push(`${state.activations ?? 0} of ${state.activation_limit} sites`);
    if (state.expires) parts.push(`${status === 'expired' ? 'Expired' : 'Renews'} ${formatDate(state.expires)}`);
    else if (status === 'active') parts.push('No expiry');
    return parts.join(' · ') || null;
}

function CreemLicense({ initial }) {
    const [state, setState] = useState(initial);
    const [keyInput, setKeyInput] = useState('');
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const status = CREEM_STATUS[state.status] ? state.status : 'unconfigured';
    const present = CREEM_STATUS[status];
    const hasKey = Boolean(state.key_hint);
    const canEnterKey = status !== 'active' && status !== 'unconfigured';

    const run = async (what, call, okMessage) => {
        setBusy(what);
        setError('');
        setSuccess('');
        try {
            const res = await call();
            if (res && typeof res.status === 'string') {
                setState(res);
            }
            if (res?.ok === false) {
                setError(res.message || 'That didn\'t work. Try again.');
            } else if (okMessage) {
                setSuccess(okMessage);
                setKeyInput('');
            }
        } catch {
            setError('Couldn\'t reach your site. Check your connection and try again.');
        } finally {
            setBusy('');
        }
    };

    const activate = (e) => {
        e.preventDefault();
        const key = keyInput.trim();
        if (key) run('activate', () => activateLicense(key), 'License activated.');
    };

    return (
        <Shell sub="Hooked on Facets Pro is licensed with the key from your purchase receipt. Updates arrive through the normal WordPress Updates screen. Billing and renewals are handled from the link in your receipt email.">
            <StatusRow
                status={status}
                tone={present.tone}
                label={present.label}
                meta={creemMeta(state, status)}
                detail={CREEM_DETAIL[status]}
            />

            {canEnterKey && (
                <form className="hof-ai-settings-input-row" onSubmit={activate}>
                    <label className="hof-ai-settings-label" htmlFor="hof-license-key">
                        {hasKey ? 'Enter a different license key' : 'License key'}
                    </label>
                    <div className="hof-ai-settings-input-wrap">
                        <span className="hof-ai-settings-input-icon"><IconKey size={16} stroke={1.75} /></span>
                        <input
                            id="hof-license-key"
                            type="text"
                            autoComplete="off"
                            spellCheck="false"
                            className="hof-ai-settings-input"
                            placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                            value={keyInput}
                            onChange={(e) => setKeyInput(e.target.value)}
                            disabled={Boolean(busy)}
                        />
                    </div>
                    <div className="hof-ai-settings-actions">
                        <button
                            type="submit"
                            className="hof-ai-settings-btn hof-ai-settings-btn--primary"
                            disabled={Boolean(busy) || keyInput.trim() === ''}
                        >
                            {busy === 'activate' ? 'Activating…' : 'Activate'}
                        </button>
                        {state.urls?.buy && (
                            <a className="hof-btn" href={state.urls.buy} target="_blank" rel="noreferrer">Buy a license</a>
                        )}
                    </div>
                </form>
            )}

            {hasKey && (
                <div className="hof-ai-settings-actions hof-license-manage">
                    <button
                        type="button"
                        className="hof-ai-settings-btn hof-ai-settings-btn--ghost"
                        disabled={Boolean(busy)}
                        onClick={() => run('refresh', () => getLicense(true), 'Checked with the license server.')}
                    >
                        {busy === 'refresh' ? 'Checking…' : 'Check again'}
                    </button>
                    <button
                        type="button"
                        className="hof-ai-settings-btn hof-ai-settings-btn--ghost"
                        disabled={Boolean(busy)}
                        onClick={() => run('deactivate', deactivateLicense, 'License removed from this site. Its slot is free for another site.')}
                    >
                        {busy === 'deactivate' ? 'Deactivating…' : 'Deactivate on this site'}
                    </button>
                </div>
            )}

            {error && <p className="hof-ai-settings-msg hof-ai-settings-msg--error" role="alert">{error}</p>}
            {success && <p className="hof-ai-settings-msg hof-ai-settings-msg--ok" role="status">{success}</p>}
        </Shell>
    );
}

// --- Freemius (Pro 1.3) -----------------------------------------------------

const FS_STATUS = {
    active:        { tone: 'ok',   label: 'Active' },
    trial:         { tone: 'ok',   label: 'Trial' },
    expired:       { tone: 'warn', label: 'Expired' },
    not_activated: { tone: 'warn', label: 'Not activated' },
    unconfigured:  { tone: 'warn', label: 'Licensing isn\'t set up' },
};

const FS_DETAIL = {
    active:        'Pro is licensed on this site. Updates arrive on the WordPress Updates screen.',
    trial:         'You\'re on a trial. Upgrade before it ends to keep updates coming.',
    expired:       'Your license has expired. Pro keeps working, but updates stop until you renew.',
    not_activated: 'Activate your license to get automatic updates for Pro.',
    unconfigured:  'This build isn\'t connected to Freemius yet, so Pro runs without license checks or automatic updates.',
};

// Primary and secondary actions per status: [label, url key(s)]. With several
// keys the first URL Pro sends wins: an unregistered add-on gets Freemius'
// license-key form (activate), a registered one its account page.
const FS_ACTIONS = {
    active:        [['Manage license', 'account']],
    trial:         [['Upgrade', 'upgrade'], ['Manage license', 'account']],
    expired:       [['Renew', 'upgrade'], ['Manage license', 'account']],
    not_activated: [['Activate license', ['activate', 'account']], ['Buy a license', 'upgrade']],
    unconfigured:  [],
};

function FreemiusLicense({ state }) {
    const status  = FS_STATUS[state?.status] ? state.status : 'unconfigured';
    const present = FS_STATUS[status];
    const urls    = state?.urls || {};
    const actions = FS_ACTIONS[status]
        .map(([label, keys]) => [label, [].concat(keys).map((k) => urls[k]).find(Boolean)])
        .filter(([, href]) => href);

    let meta = null;
    if (state?.plan || state?.expires || status === 'active') {
        const when = state?.expires
            ? `${status === 'expired' ? 'Expired' : status === 'trial' ? 'Trial ends' : 'Renews'} ${formatDate(state.expires)}`
            : status === 'active' ? 'Lifetime license' : null;
        meta = [state?.plan && `${state.plan} plan`, when].filter(Boolean).join(' · ');
    }

    return (
        <Shell sub="Hooked on Facets Pro is licensed through Freemius. Activate, renew or move your license from your account; updates arrive through the normal WordPress Updates screen.">
            <StatusRow status={status} tone={present.tone} label={present.label} meta={meta} detail={FS_DETAIL[status]} />
            {actions.length > 0 && (
                <div className="hof-ai-settings-actions">
                    {actions.map(([label, href], i) => (
                        <a key={label} href={href} className={`hof-btn ${i === 0 ? 'hof-btn-primary' : ''}`}>
                            {label}
                        </a>
                    ))}
                </div>
            )}
        </Shell>
    );
}

// --- Screen -----------------------------------------------------------------

export default function LicenseSettings() {
    const [state, setState] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let live = true;
        getLicense()
            .then((data) => { if (live) setState(data); })
            .catch(() => { if (live) setError('Could not load the license state.'); });
        return () => { live = false; };
    }, []);

    if (error) {
        return (
            <Shell sub="Hooked on Facets Pro's license on this site.">
                <p className="hof-ai-settings-msg hof-ai-settings-msg--error" role="alert">{error}</p>
            </Shell>
        );
    }

    if (!state) {
        return (
            <div className="hof-ai-settings">
                <h2 className="hof-ai-settings-title">License</h2>
                <p className="hof-ai-settings-status">Loading…</p>
            </div>
        );
    }

    return state.provider === 'creem' ? <CreemLicense initial={state} /> : <FreemiusLicense state={state} />;
}
