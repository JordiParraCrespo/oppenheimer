/**
 * Dependency-cruiser rules for a platform kit (`packages/frontend/web`). A kit is organised by concern; each concern
 * has the kind directories a feature has. The concerns are layered, and the
 * layering is what keeps `shell` from becoming everything's dependency.
 *
 * @param {object} options
 * @param {string[]} options.leaves concerns that import only the design system and the kernel
 * @param {string[]} options.middle concerns that build on the leaves
 * @param {string[]} options.top concerns that may import anything below
 */
module.exports = function frontendKit({ leaves, middle, top }) {
  const group = (names) => `^src/(${names.join('|')})/`;
  return {
    forbidden: [
      {
        name: 'no-circular',
        severity: 'error',
        from: {},
        // A type-only edge (a route importing the app's `RouterContext` type)
        // cannot cause a runtime cycle; only value imports count.
        to: { circular: true, viaOnly: { dependencyTypesNot: ['type-only'] } },
      },
      {
        name: 'leaves-stay-leaves',
        comment: `${leaves.join(', ')} import only the design system and the kernel — never another concern above them.`,
        severity: 'error',
        from: { path: group(leaves) },
        to: { path: group([...middle, ...top]) },
      },
      {
        name: 'middle-below-top',
        comment: `${middle.join(', ')} build on the leaves and never on ${top.join(', ')}.`,
        severity: 'error',
        from: { path: group(middle) },
        to: { path: group(top) },
      },
      {
        name: 'concerns-meet-at-their-index',
        comment:
          'A concern imports another concern through that concern’s index.ts, so the dependency is visible in one place and nothing internal leaks.',
        severity: 'error',
        from: { path: '^src/([^/]+)/' },
        to: { path: '^src/[^/]+/', pathNot: ['^src/$1/', '^src/[^/]+/index\\.ts$'] },
      },
      {
        name: 'lib-has-no-jsx',
        comment: 'A concern’s lib/ holds helpers; rendering belongs in components/.',
        severity: 'error',
        from: { path: '^src/[^/]+/lib/' },
        to: { path: 'node_modules/react/', dependencyTypesNot: ['type-only'] },
      },
      {
        name: 'kit-knows-no-product',
        comment:
          'The kit sits below the apps of its platform and imports only the kernel, never a product package. A component that needs a product hook is a feature, not kit.',
        severity: 'error',
        from: {},
        to: { path: 'packages/frontend/(consumer|admin)/' },
      },
      {
        name: 'kit-knows-no-app',
        severity: 'error',
        from: {},
        to: { path: '^apps/|/apps/' },
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
