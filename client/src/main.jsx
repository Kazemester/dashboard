import React from 'react';
import { createRoot } from 'react-dom/client';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './styles.css';
import './shell/shell.css';
import './theme-glass.css';
import App from './App.jsx';
import { applyAppearance, cachedAppearance } from './theme.js';
import { useLang } from './i18n.js';

// Start in the last used colours (the saved appearance from the DB is applied once loaded).
applyAppearance(cachedAppearance());

// The whole app remounts when the language changes, so every t() call is re-evaluated.
function Root() {
  const lang = useLang();
  return <App key={lang} />;
}

createRoot(document.getElementById('root')).render(<Root />);
