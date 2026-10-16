import React from 'react';
import { createRoot } from 'react-dom/client';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './styles.css';
import App from './App.jsx';
import { applyAppearance, cachedAppearance } from './theme.js';

// Start in the last used colours (the saved appearance from the DB is applied once loaded).
applyAppearance(cachedAppearance());

createRoot(document.getElementById('root')).render(<App />);
