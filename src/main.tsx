import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import 'katex/dist/katex.min.css';
import './index.css';

// An open tab can request a chunk removed by a newer deployment.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const key = 'wiki-chunk-reload';
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, '1');
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

