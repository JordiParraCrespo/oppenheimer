/**
 * Architecture fitness rules for the Domain-Driven Hexagon layout.
 * See ARCHITECTURE.md. Run with: pnpm --filter @oppenheimer/api arch
 *
 * Rules are opt-in by folder name (`domain/`, `commands/`, `queries/`, …), so
 * infrastructure-only modules (auth, health, queue) are not falsely flagged.
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'Circular dependencies make the graph impossible to reason about.',
      severity: 'error',
      from: { path: '^src/' },
      to: { circular: true },
    },
    {
      name: 'domain-stays-pure',
      comment:
        'The domain layer may only depend on @oppenheimer/backend-ddd, @oppenheimer/backend-authz, @oppenheimer/shared and node core. No NestJS, TypeORM, oxide.ts, @oppenheimer/backend-core, or any other infrastructure.',
      severity: 'error',
      from: { path: '^src/[^/]+/domain/' },
      to: {
        // Ignore node built-ins; flag everything else that is not an allowed
        // workspace package or another domain file in the same layer.
        dependencyTypesNot: ['core'],
        pathNot: ['^src/[^/]+/domain/', 'packages/(backend/ddd|backend/authz|shared)/'],
      },
    },
    {
      name: 'domain-no-outward-imports',
      comment:
        'The domain must not depend on its own outer layers (database, commands, queries, application, dtos).',
      severity: 'error',
      from: { path: '^src/([^/]+)/domain/' },
      to: { path: '^src/$1/(database|commands|queries|application|dtos)/' },
    },
    {
      name: 'handlers-depend-on-port-not-adapter',
      comment:
        'Application/interface layers must depend on the repository port, never the concrete TypeORM adapter (*.repository.ts).',
      severity: 'error',
      from: { path: '^src/[^/]+/(commands|queries|application)/' },
      to: {
        path: '\\.repository\\.ts$',
        pathNot: '\\.repository\\.port\\.ts$',
      },
    },
    {
      name: 'orm-entity-stays-in-database',
      comment:
        'TypeORM persistence models (*.orm-entity.ts) belong to the database layer. Outer layers use the domain entity instead. (The mapper and module wiring are exempt.)',
      severity: 'error',
      from: {
        path: '^src/[^/]+/(domain|commands|queries|application|dtos)/',
      },
      to: { path: '\\.orm-entity\\.ts$' },
    },
    {
      name: 'no-cross-slice-imports',
      comment:
        'Use-case slices are vertical and self-contained. Do not import another slice’s internals (handlers, controllers, request DTOs). Reusing another slice’s bus message (*.command.ts / *.query.ts) to dispatch is allowed.',
      severity: 'error',
      from: { path: '^src/([^/]+)/(commands|queries)/([^/]+)/' },
      to: {
        path: '^src/$1/(commands|queries)/([^/]+)/',
        pathNot: ['^src/$1/(commands|queries)/$3/', '\\.(command|query)\\.ts$'],
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'types', 'default'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
