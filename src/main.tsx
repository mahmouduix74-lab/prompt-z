import {StrictMode, lazy, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// The admin dashboard is its own chunk, so visitors never download it.
const AdminApp = lazy(() => import('./admin/AdminApp.tsx'));
const isAdmin = /^\/admin(\/|$)/.test(location.pathname);

/**
 * Counts one visit per browser session for the dashboard's Traffic page (src/server/visits.ts):
 * where the visitor came from and the campaign link (?c=), which then leaves the address bar.
 */
function recordVisit() {
  const params = new URLSearchParams(location.search);
  const campaign = params.get('c') || '';
  if (campaign) {
    params.delete('c');
    const query = params.toString();
    history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
  }
  try {
    if (sessionStorage.getItem('pz_visit')) return;
    sessionStorage.setItem('pz_visit', '1');
  } catch {
    // Storage blocked: count the visit anyway.
  }
  fetch('/api/visit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: document.referrer, c: campaign, utm: params.get('utm_source') || '' }),
    keepalive: true,
  }).catch(() => {});
}
if (!isAdmin) recordVisit();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdmin ? (
      <Suspense fallback={null}>
        <AdminApp />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
