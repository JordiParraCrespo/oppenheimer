/**
 * i18next namespaces, one per product area. English filenames under
 * `{locale}/{namespace}.json` are the source of truth; `{locale}/index.json`
 * is assembled from them for the JSON export path.
 *
 * Call sites keep using dotted keys on the merged default namespace
 * (`t('auth.login')`). The same copy is also registered under its area name
 * (`t('login', { ns: 'auth' })`) so a screen can load a single namespace.
 */
import namespaceList from './namespaces.json';

export const namespaces = namespaceList as unknown as readonly [
  'common',
  'validation',
  'errors',
  'auth',
  'sessions',
  'hosts',
  'home',
  'nav',
  'control',
  'language',
  'consent',
  'onboarding',
  'pages',
  'public',
  'table',
  'theme',
  'toasts',
  'emails',
];

export type Namespace = (typeof namespaces)[number];
