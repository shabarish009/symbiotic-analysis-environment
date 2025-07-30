/**
 * Main Entry Point
 * React application entry point for Tauri
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Create root element and render app
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Log successful initialization
console.log('Symbiotic Analysis Environment - React Frontend Initialized');

// Prevent context menu on production builds
if (import.meta.env.PROD) {
  document.addEventListener('contextmenu', e => {
    e.preventDefault();
  });
}

// Prevent text selection on UI elements (XP behavior)
document.body.style.userSelect = 'none';
document.body.style.webkitUserSelect = 'none';
