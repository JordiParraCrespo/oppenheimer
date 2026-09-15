import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@/components/theme-provider';
import { OppenheimerAppProvider } from '@/providers/oppenheimer-provider';
import { QueryProvider } from '@/providers/query-provider';
import { App } from './app';
import { i18nReady } from './lib/i18n';
import './styles/globals.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);

const tree = (
  <StrictMode>
    <ThemeProvider>
      <QueryProvider>
        <OppenheimerAppProvider>
          <App />
        </OppenheimerAppProvider>
      </QueryProvider>
    </ThemeProvider>
  </StrictMode>
);

const render = () => root.render(tree);

/**
 * Rendering waits for the reader's message catalog, which is now loaded rather
 * than bundled for every locale but the default. Both settlements render: a
 * catalog that fails to load must still show the app — i18next falls back to
 * the bundled default locale, and a blank page would be a far worse outcome
 * than English copy.
 *
 * Both handlers passed to one `then`, rather than `finally`, because `finally`
 * re-throws: the promise it returns stays rejected, so the catalog failure this
 * exists to survive would surface as an unhandled rejection anyway.
 *
 * For the default locale nothing is fetched, so this settles in a microtask.
 */
i18nReady.then(render, render);
