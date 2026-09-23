/**
 * Per-library vendor chunking for the Vite SPAs.
 *
 * Rollup's default is one entry chunk holding every dependency, which means any
 * change to app code re-downloads React, the router, the forms stack and the
 * auth client along with it. Naming a chunk per library instead means a release
 * invalidates app code and nothing else, and a dependency bump invalidates only
 * that dependency.
 *
 * The trade, measured on `apps/web` (gzipped, first load): 328KB in one chunk
 * against 376KB across ten. Splitting costs ~48KB because the same modules
 * minify and compress worse once they cannot share a scope — and coarser groups
 * do not help, a two-chunk split measured 377KB. What it buys: a release that
 * touches only app code re-downloads 42KB instead of 305KB. That is only worth
 * it because the assets are served `immutable` for a year
 * (`apps/web/nginx.conf`), so a returning reader re-fetches nothing else; if
 * this app were a page people see once, the default would be the better call.
 *
 * Groups are by release cadence, not by size: libraries that version together
 * (a router and its core, a query client and its persisters) belong in one
 * chunk, because splitting them would invalidate both anyway.
 */
const GROUPS = {
  'vendor-react': ['react', 'react-dom', 'scheduler'],
  'vendor-router': ['@tanstack/react-router', '@tanstack/router-core', '@tanstack/history'],
  'vendor-query': [
    '@tanstack/react-query',
    '@tanstack/query-core',
    '@tanstack/react-query-persist-client',
    '@tanstack/query-persist-client-core',
    '@tanstack/query-async-storage-persister',
  ],
  'vendor-i18n': [
    'i18next',
    'react-i18next',
    'i18next-browser-languagedetector',
    'html-parse-stringify',
    'void-elements',
  ],
  'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
  'vendor-auth': ['better-auth', '@better-auth', '@better-fetch', 'nanostores', 'jose'],
  'vendor-ui': [
    '@base-ui',
    'lucide-react',
    'sonner',
    'vaul',
    'cmdk',
    'class-variance-authority',
    'clsx',
    'tailwind-merge',
  ],
  'vendor-di': ['inversify', '@inversifyjs', 'reflect-metadata'],
};

/**
 * `/node_modules/<name>/` rather than a bare substring: pnpm's store puts the
 * version in the path (`.pnpm/react-dom@19.1.0_react@19.1.0/node_modules/react-dom/`),
 * and a loose `react` would also claim `react-hook-form` and `@base-ui/react`.
 */
const MATCHERS = Object.entries(GROUPS).map(([chunk, packages]) => [
  chunk,
  packages.map((name) => `/node_modules/${name}/`),
]);

/**
 * Rollup `manualChunks`. Anything not listed above — including every workspace
 * package, which is first-party code — stays with the entry chunk.
 */
export function vendorChunks(id) {
  const path = id.replaceAll('\\', '/');
  if (!path.includes('/node_modules/')) return undefined;

  for (const [chunk, needles] of MATCHERS) {
    if (needles.some((needle) => path.includes(needle))) return chunk;
  }

  return undefined;
}
