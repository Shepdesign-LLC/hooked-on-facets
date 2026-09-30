import { createRoot } from 'react-dom/client';
import App from './App.jsx';
// Geist ships with the bundle, so wp-admin never calls out to a font CDN.
import '@fontsource-variable/geist/wght.css';
import '@fontsource-variable/geist-mono/wght.css';
import './styles/admin.css';

const mount = document.getElementById('hof-admin-root');
if (mount) {
    createRoot(mount).render(<App bootstrap={window.hofAdmin || {}} />);
}
