import {
    IconArrowsShuffle,
    IconDatabase,
    IconFilter,
    IconKey,
    IconLayoutGrid,
    IconPalette,
    IconSearch,
    IconSettings,
    IconTools,
} from '@tabler/icons-react';

// The nine admin screens. All stay; the rail only groups them.
export const VIEWS = [
    { id: 'dashboard',  label: 'Dashboard',     section: 'Main',   Icon: IconLayoutGrid },
    { id: 'facets',     label: 'Facets',        section: 'Main',   Icon: IconFilter },
    { id: 'queryloops', label: 'Query loops',   section: 'Main',   Icon: IconArrowsShuffle },
    { id: 'indexer',    label: 'Indexer',       section: 'Main',   Icon: IconDatabase },
    { id: 'blueprint',  label: 'Blueprint',     section: 'Studio', Icon: IconTools },
    { id: 'tokens',     label: 'Design tokens', section: 'Studio', Icon: IconPalette },
    { id: 'seo',        label: 'SEO',           section: 'System', Icon: IconSearch },
    { id: 'license',    label: 'License',       section: 'System', Icon: IconKey },
    { id: 'settings',   label: 'Settings',      section: 'System', Icon: IconSettings },
];

export const SECTION_ORDER = ['Main', 'Studio', 'System'];

// The License screen belongs to the HOF Pro add-on, so without it the rail
// shows eight entries — the same as before this layout.
export const availableViews = (proActive) =>
    proActive ? VIEWS : VIEWS.filter((v) => v.id !== 'license');
