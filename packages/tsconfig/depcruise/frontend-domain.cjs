/**
 * Dependency-cruiser rules for a domain package (`packages/frontend/core`,
 * `/consumer`). The domain is platform-free and product-scoped: `modules/`
 * never knows React, the kernel never knows a product, and a product package
 * never knows another.
 *
 * @param {object} options
 * @param {'core' | 'consumer' | 'admin'} options.role
 */
module.exports = function frontendDomain({ role }) {
  const forbiddenPackages =
    role === 'core'
      ? ['packages/frontend/(consumer|admin)/']
      : [`packages/frontend/${role === 'consumer' ? 'admin' : 'consumer'}/`];
  return {
    forbidden: [
      {
        name: 'no-circular',
        severity: 'error',
        from: {},
        to: { circular: true, viaOnly: { dependencyTypesNot: ['type-only'] } },
      },
      {
        name: 'domain-knows-no-react',
        comment:
          'modules/ is entities, repositories and services. React lives in react/, which imports modules/ and never the other way round.',
        severity: 'error',
        from: { path: '^src/modules/' },
        to: { path: ['^src/react/', 'node_modules/react/', 'node_modules/@tanstack/react-query/'] },
      },
      {
        name: role === 'core' ? 'kernel-knows-no-product' : 'products-never-meet',
        comment:
          role === 'core'
            ? 'The kernel sits below every product and imports none. What a product builds on is a kernel contract (a query key, a persist option), not an import.'
            : 'A product package never imports another product package. Where products meet, the meeting point is a kernel contract.',
        severity: 'error',
        from: {},
        to: { path: forbiddenPackages },
      },
      {
        name: 'domain-knows-no-platform',
        comment: 'Nothing here is platform code: no DOM, no router, no platform kit.',
        severity: 'error',
        from: {},
        to: {
          path: [
            'packages/frontend/(web|mobile)/',
            'node_modules/(react-dom|@tanstack/react-router)/',
          ],
        },
      },
    ],
    options: {
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
