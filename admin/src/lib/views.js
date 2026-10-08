import {
    IconArrowsShuffle,
    IconDatabase,
    IconFilter,
    IconKey,
    IconLayoutGrid,
    IconPalette,
    IconSearch,
    IconSettings,
    IconSparkles,
} from '@tabler/icons-react';

// The nine admin screens. All stay; the rail only groups them. Ids are
// stable (routes, help topics); labels are what a store owner reads.
export const VIEWS = [
    { id: 'dashboard',  label: 'Dashboard',   section: 'Build',  Icon: IconLayoutGrid },
    { id: 'facets',     label: 'Facets',      section: 'Build',  Icon: IconFilter },
    { id: 'queryloops', label: 'Query loops', section: 'Build',  Icon: IconArrowsShuffle },
    { id: 'indexer',    label: 'Indexer',     section: 'Build',  Icon: IconDatabase },
    { id: 'blueprint',  label: 'Playground',  section: 'Design', Icon: IconSparkles },
    { id: 'tokens',     label: 'Styles',      section: 'Design', Icon: IconPalette },
    { id: 'seo',        label: 'SEO',         section: 'Setup',  Icon: IconSearch },
    { id: 'license',    label: 'License',     section: 'Setup',  Icon: IconKey },
    { id: 'settings',   label: 'Settings',    section: 'Setup',  Icon: IconSettings },
];

export const SECTION_ORDER = ['Build', 'Design', 'Setup'];

// The License screen belongs to the HOF Pro add-on, so without it the rail
// shows eight entries — the same as before this layout.
export const availableViews = (proActive) =>
    proActive ? VIEWS : VIEWS.filter((v) => v.id !== 'license');
