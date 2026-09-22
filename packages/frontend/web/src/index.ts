/**
 * @oppenheimer/frontend-web — what both Vite apps share below their routes.
 *
 * Organised by concern, each with the same kind directories a feature has
 * (`components/`, `dialogs/`, `hooks/`, `lib/`). Leaves first: `platform`,
 * `theme`, `i18n`, `analytics`, `forms` import only the design system and
 * the kernel; `table`, `layout`, `roles` build on those; `shell` and `auth`
 * on anything below. Nothing here imports a product package.
 */
export * from './analytics';
export * from './auth';
export * from './forms';
export * from './hosts';
export * from './i18n';
export * from './layout';
export * from './platform';
export * from './roles';
export * from './shell';
export * from './table';
export * from './theme';
