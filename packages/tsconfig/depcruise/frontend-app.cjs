/**
 * Dependency-cruiser rules for a frontend app (`apps/web`, `apps/admin-web`,
 * `apps/mobile`, `apps/admin-mobile`). Each app's `.dependency-cruiser.cjs`
 * calls this with its product and its route directory; the rules are the
 * layout contract in `.agents/rules/frontend-architecture.md`.
 *
 * The kind directories of a feature are import boundaries as much as folders:
 * `forms/` and `components/` render props and never fetch, `screens/`,
 * `sections/` and `dialogs/` are where a query lands, `hooks/` is where an
 * effect lives, `lib/` has no JSX. Routes compose; they never reach into a
 * feature's internals. Features never import each other — what two need moves
 * to the platform kit.
 */
const QUERY_PORT = [
  // the domain packages' React bindings, resolved through the workspace link
  'packages/frontend/(core|consumer|admin)/(dist|src)/react/',
  'node_modules/@tanstack/react-query/',
];
const ROUTER = ['node_modules/@tanstack/react-router/', 'node_modules/expo-router/'];

/**
 * @param {object} options
 * @param {'consumer' | 'admin'} options.product the product package this app loads
 * @param {string} options.routes the route directory, `src/routes` or `app`
 * @param {string} options.features the feature directory, `src/features` or `features`
 * @param {'web' | 'mobile'} options.platform which kit the app builds on
 */
module.exports = function frontendApp({ product, routes, features, platform }) {
  const other = product === 'consumer' ? 'admin' : 'consumer';
  const kit = `packages/frontend/${platform}/src/`;
  const kitEntry =
    platform === 'web'
      ? `${kit}index\\.ts$`
      : `${kit}(index|[a-z0-9-]+/index|platform/lib/polyfills)\\.ts$`;

  return {
    forbidden: [
      {
        name: 'no-circular',
        comment: 'Circular dependencies make the graph impossible to reason about.',
        severity: 'error',
        from: {},
        // A type-only edge (a route importing the app's `RouterContext` type)
        // cannot cause a runtime cycle; only value imports count.
        to: { circular: true, viaOnly: { dependencyTypesNot: ['type-only'] } },
      },
      {
        name: 'features-are-islands',
        comment:
          'A feature never imports another feature. Something two features need belongs in the platform kit, promoted when the second consumer appears.',
        severity: 'error',
        from: { path: `^${features}/([^/]+)/` },
        to: { path: `^${features}/`, pathNot: `^${features}/$1/` },
      },
      {
        name: 'routes-compose',
        comment:
          'A route file mounts a screen or composes sections and dialogs, and may read a feature’s lib/ for a search schema. It never reaches into forms, components or hooks.',
        severity: 'error',
        from: { path: `^${routes}/` },
        to: { path: `^${features}/[^/]+/(forms|components|hooks)/` },
      },
      {
        name: 'forms-and-components-stay-pure',
        comment:
          'forms/ and components/ take props and render. They never call the query port or the router; the section, dialog or screen above them does and passes the result down.',
        severity: 'error',
        from: { path: `^${features}/[^/]+/(forms|components)/` },
        to: { path: [...QUERY_PORT, ...ROUTER] },
      },
      {
        name: 'lib-has-no-jsx',
        comment:
          'features/*/lib/ holds types, mappers and constants. Rendering belongs in a component.',
        severity: 'error',
        from: { path: `^${features}/[^/]+/lib/` },
        to: { path: 'node_modules/react/', dependencyTypesNot: ['type-only'] },
      },
      {
        name: 'one-product-per-app',
        comment: `This app is the ${product} product and never loads the ${other} package.`,
        severity: 'error',
        from: {},
        to: { path: `packages/frontend/${other}/` },
      },
      {
        name: 'kit-through-its-entry',
        comment:
          'The platform kit is imported by its package name, never by a path into its src/. What is not exported is not public.',
        severity: 'error',
        from: {},
        to: { path: kit, pathNot: kitEntry },
      },
    ],
    options: {
      // Workspace packages resolve to their real path, outside node_modules;
      // their own rules live in their own config, so stop at the boundary.
      doNotFollow: { path: 'node_modules|^../' },
      tsConfig: { fileName: 'tsconfig.json' },
      // 'specify' keeps type-only imports apart from value imports, so a lib/
      // file may name `ReactNode` without being told it renders.
      tsPreCompilationDeps: 'specify',
      enhancedResolveOptions: {
        exportsFields: ['exports'],
        conditionNames: ['import', 'require', 'types', 'default'],
      },
      reporterOptions: { text: { highlightFocused: true } },
    },
  };
};
