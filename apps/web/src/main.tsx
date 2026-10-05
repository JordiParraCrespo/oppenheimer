import { i18nReady, ThemeProvider } from '@oppenheimer/frontend-web';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { app } from '@/lib/oppenheimer';
import { OppenheimerAppProvider } from '@/providers/oppenheimer-provider';
import { QueryProvider } from '@/providers/query-provider';
import { App } from './app';
import './styles/globals.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');
const root = ReactDOM.createRoot(container);

const tree = (
  <StrictMode>
    <ThemeProvider>
      <QueryProvider app={app}>
        <OppenheimerAppProvider>
          <App />
        </OppenheimerAppProvider>
      </QueryProvider>
    </ThemeProvider>
  </StrictMode>
);

const render = () => root.render(tree);

/**
 * Render on either settlement of the reader's catalog: one that fails to load
 * falls back to the bundled default locale, which beats a blank page. Both
 * handlers go to one `then`, not `finally`, because `finally` re-throws and the
 * failure would surface as an unhandled rejection. The default locale fetches
 * nothing, so this settles in a microtask.
 */
i18nReady.then(render, render);
