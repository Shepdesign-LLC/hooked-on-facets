// Small display formatters shared by the admin screens.

const nf = new Intl.NumberFormat('en-US');

/** 1234 → "1,234"; anything that isn't a finite number → "—". */
export function fmt(n) {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
    return nf.format(n);
}

/** Unix seconds → "just now", "5m ago", "2h ago", "3d ago", "2mo ago". */
export function ago(ts, now = Date.now() / 1000) {
    const seconds = Math.floor(now - ts);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
}

/** Seconds → "19.4 s", or "2 min 5 s" past a minute. */
export function duration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '';
    if (seconds < 60) return `${seconds.toFixed(1)} s`;
    const m = Math.floor(seconds / 60);
    return `${m} min ${Math.round(seconds - m * 60)} s`;
}
