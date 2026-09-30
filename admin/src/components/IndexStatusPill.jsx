import Tip from './ui/Tip.jsx';

const COPY =
    'HOF keeps its own fast lookup table of every value you facet on. It updates as you edit content, and a full ' +
    'rebuild runs in the background when you reindex. Green means no rebuild is running right now.';

// Global index state, read from GET /indexer/stats.
export default function IndexStatusPill({ stats }) {
    const bg = stats?.background;
    const running = !!bg?.running;
    const label = running
        ? `Indexing ${Math.round(bg.percent || 0)}%`
        : stats ? 'Index up to date' : 'Index status';

    return (
        <span className={`hof-pill ${running ? 'hof-pill-busy' : stats ? 'hof-pill-good' : ''}`}>
            <i aria-hidden="true" />
            {label}
            <Tip text={COPY} align="left" />
        </span>
    );
}
