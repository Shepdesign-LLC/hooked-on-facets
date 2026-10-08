import { useEffect, useState } from 'react';
import { IconAlertTriangle, IconCheck, IconKey } from '@tabler/icons-react';
import { getLicense } from '../api.js';

// Pro is licensed through Freemius: activation, renewal and seat moves happen
// on Freemius' Account screen, and updates arrive through WordPress' own
// Updates screen. This screen only reports the state and links there.
const STATUS = {
    active:        { tone: 'ok',   label: 'Active' },
    trial:         { tone: 'ok',   label: 'Trial' },
    expired:       { tone: 'warn', label: 'Expired' },
    not_activated: { tone: 'warn', label: 'Not activated' },
    unconfigured:  { tone: 'warn', label: 'Licensing isn\'t set up' },
};

const DETAIL = {
    active:        'Pro is licensed on this site. Updates arrive on the WordPress Updates screen.',
    trial:         'You\'re on a trial. Upgrade before it ends to keep updates coming.',
    expired:       'Your license has expired. Pro keeps working, but updates stop until you renew.',
    not_activated: 'Activate your license to get automatic updates for Pro.',
    unconfigured:  'This build isn\'t connected to Freemius yet, so Pro runs without license checks or automatic updates.',
};

// Primary and secondary actions per status: [label, url key(s)]. With several
// keys the first URL Pro sends wins: an unregistered add-on gets Freemius'
// license-key form (activate), a registered one its account page.
const ACTIONS = {
    active:        [['Manage license', 'account']],
    trial:         [['Upgrade', 'upgrade'], ['Manage license', 'account']],
    expired:       [['Renew', 'upgrade'], ['Manage license', 'account']],
    not_activated: [['Activate license', ['activate', 'account']], ['Buy a license', 'upgrade']],
    unconfigured:  [],
};

const formatDate = (iso) => {
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime())
        ? iso
        : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

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

    if (!state && !error) {
        return (
            <div className="hof-ai-settings">
                <h2 className="hof-ai-settings-title">License</h2>
                <p className="hof-ai-settings-status">Loading…</p>
            </div>
        );
    }

    const status  = STATUS[state?.status] ? state.status : 'unconfigured';
    const present = STATUS[status];
    const urls    = state?.urls || {};
    const actions = ACTIONS[status]
        .map(([label, keys]) => [label, [].concat(keys).map((k) => urls[k]).find(Boolean)])
        .filter(([, href]) => href);
    const StatusIcon = present.tone === 'ok' ? IconCheck : IconAlertTriangle;

    let meta = null;
    if (state?.plan || state?.expires || status === 'active') {
        const when = state?.expires
            ? `${status === 'expired' ? 'Expired' : status === 'trial' ? 'Trial ends' : 'Renews'} ${formatDate(state.expires)}`
            : status === 'active' ? 'Lifetime license' : null;
        meta = [state?.plan && `${state.plan} plan`, when].filter(Boolean).join(' · ');
    }

    return (
        <div className="hof-ai-settings" id="license">
            <header className="hof-ai-settings-header">
                <span className="hof-ai-settings-icon"><IconKey size={20} stroke={1.75} /></span>
                <div>
                    <h2 className="hof-ai-settings-title">License</h2>
                    <p className="hof-ai-settings-sub">
                        Hooked on Facets Pro is licensed through Freemius. Activate, renew or move your
                        license from your account; updates arrive through the normal WordPress Updates screen.
                    </p>
                </div>
            </header>

            <section className="hof-ai-settings-section">
                <h3 className="hof-ai-settings-section-title">Current status</h3>

                {error ? (
                    <p className="hof-ai-settings-msg hof-ai-settings-msg--error" role="alert">{error}</p>
                ) : (
                    <>
                        <div className={`hof-ai-settings-row hof-ai-settings-row--${present.tone}`} data-status={status}>
                            <span className="hof-ai-settings-row-icon">
                                <StatusIcon size={16} stroke={2} aria-hidden="true" />
                            </span>
                            <div>
                                <p className="hof-ai-settings-row-line"><strong>{present.label}</strong></p>
                                {meta && <p className="hof-ai-settings-row-sub hof-license-meta">{meta}</p>}
                                <p className="hof-ai-settings-row-sub">{DETAIL[status]}</p>
                            </div>
                        </div>

                        {actions.length > 0 && (
                            <div className="hof-ai-settings-actions">
                                {actions.map(([label, href], i) => (
                                    <a
                                        key={label}
                                        href={href}
                                        className={`hof-btn ${i === 0 ? 'hof-btn-primary' : ''}`}
                                    >
                                        {label}
                                    </a>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}
