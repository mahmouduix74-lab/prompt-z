import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// /v2 is the new black-and-white design; it loads its own code only when opened.
const AppV2 = lazy(() => import('./v2/AppV2.tsx'));
const isV2 = window.location.pathname.replace(/\/+$/, '') === '/v2';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isV2 ? (
      <Suspense fallback={null}>
        <AppV2 />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
