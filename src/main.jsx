import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ensureSeed, ensureCatalog } from './store.js';
import { startAutoSync } from './sync.js';
import './styles.css';

ensureSeed();
ensureCatalog();
createRoot(document.getElementById('root')).render(<App />);
startAutoSync();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
