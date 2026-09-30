/**
 * @oppenheimer/frontend-web — the web platform kit, below the app's routes.
 *
 * Organised by concern, each with the same kind directories a feature has
 * (`components/`, `dialogs/`, `hooks/`, `lib/`). Leaves first: `platform`,
 * `theme`, `i18n`, `analytics`, `forms` import the design system, the kernel
 * and each other, never a concern above them; `layout` and `pairing` build on
 * those; `shell` and `auth` on anything below. Nothing here imports a product
 * package.
 */
export * from './analytics';
export * from './auth';
export * from './forms';
export * from './i18n';
export * from './layout';
export * from './pairing';
export * from './platform';
export * from './shell';
export * from './theme';
