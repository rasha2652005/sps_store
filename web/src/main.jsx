import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter, MemoryRouter } from 'react-router';
import './styles.css';
import App from './App.jsx';
import { PrefsProvider } from './lib/prefs.jsx';
import { ToastProvider } from './lib/toast.jsx';

async function start() {
  // The demo build runs the whole backend inside the browser (no server needed).
  if (__DEMO__) {
    const demo = await import('./demo/runtime.js');
    await demo.install();
  }
  let Router = BrowserRouter;
  if (__DEMO__) {
    // The demo is one HTML file, so pages live in the #hash. If the page is framed somewhere that blocks history
    // changes, fall back to in-memory navigation.
    Router = HashRouter;
    try {
      window.history.replaceState(window.history.state, '');
    } catch {
      Router = MemoryRouter;
    }
  }
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <Router>
        <PrefsProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </PrefsProvider>
      </Router>
    </StrictMode>,
  );
}

start();
