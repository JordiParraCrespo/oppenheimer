import '../styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createTranslator } from '@/i18n/translator';
import { App } from './app';

const root = document.getElementById('root');
if (!root) throw new Error('popup.html has no #root');

// In the language Chrome runs in: the popup has no setting of its own.
const i18n = createTranslator(navigator.language, [initReactI18next]);
document.documentElement.lang = i18n.language;
document.title = i18n.t('title');

createRoot(root).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  </StrictMode>,
);
