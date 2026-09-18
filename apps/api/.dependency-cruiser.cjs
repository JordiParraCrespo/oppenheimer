/**
 * Architecture fitness rules for the Domain-Driven Hexagon layout.
 * See ARCHITECTURE.md. Run with: pnpm --filter @oppenheimer/api arch
 *
 * These rules police the *direction* of dependencies. The shape of a module —
 * which directories exist and what a file in each may be called — is policed
 * by `scripts/check-api-structure.mjs` (`pnpm check:api-structure`). The two
 * are meant to be read together: the structure check says where a file lives,
 * this says what it is then allowed to know about.
 *
 * Where a rule carries a `pathNot` exception naming specific files, that is a
 * ledger entry, not a carve-out: the file is a known violation waiting on a
 * refactor, and the comment says which. Adding a name to one of those lists
 * needs the same scrutiny as deleting the rule.
 */

/**
 * A spec asserts on the thing it tests, and some of them (the route-policy and
 * error-catalog sweeps) deliberately enumerate every controller in the app.
 * Tests are held to the structure contract, not to the dependency direction.
 */
const TESTS = ['\\.spec\\.ts$', '^src/[^/]+/__tests__/', '^src/__tests__/'];

/**
 * What one module may reach for in another. Anything else — a handler, a
 * controller, a concrete adapter, a mapper — is that module's own business.
 */
const CROSS_MODULE_PUBLIC_SURFACE = [
  '^src/config/', // not a module: the composition root's configuration
  // `roles` is @Global precisely so its AbilityFactory is the app's one
  // answer to "what may this principal do". Guards in `auth` and handlers
  // that check grantability ask it by design; it is published surface.
  '^src/roles/application/ability\\.factory\\.ts$',
  // The one way to report a system role the database does not have. Three
  // paths raise it — sign-up's default `user` grant, the personal workspace's
  // org-scoped `owner` grant, and the same grant on the hand-create path —
  // and only one of them lives in `roles`. Published so the other two do not
  // each invent their own answer to one fault.
  '^src/roles/application/missing-system-role\\.factory\\.ts$',
  '\\.di-tokens\\.ts$', // the token a port is bound to
  '\\.repository\\.port\\.ts$', // the port itself
  '^src/[^/]+/infrastructure/[^/]+\\.port\\.ts$', // ports for non-database adapters
  '^src/[^/]+/application/[^/]+\\.port\\.ts$', // ports an application layer publishes
  '^src/[^/]+/domain/', // entities, value objects, events, errors
  '^src/[^/]+/dtos/', // the response contracts it publishes
  '\\.(command|query)\\.ts$', // a bus message, to dispatch it
  '^src/[^/]+/(guards|decorators|interceptors)/', // the inbound adapters it offers
  '\\.resource\\.ts$', // the CASL resource it owns
  '\\.orm-entity\\.ts$', // covered, more tightly, by orm-entity-stays-in-database
  '^src/[^/]+/[^/]+\\.module\\.ts$', // module wiring imports module wiring
  // The toolkit for writing a Better Auth adapter — request headers, the error
  // invoker, the envelope narrowing. A module that owns records Better Auth
  // keeps needs these to write its own gateway, so they are published. The
  // configured instance beside them is published too, but only to adapters:
  // `better-auth-stays-behind-an-adapter` below is what enforces that.
  '^src/auth/infrastructure/better-auth\\.util\\.ts$',
  '^src/auth/infrastructure/better-auth\\.config\\.ts$',
];

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
        'The domain must not depend on its own outer layers. It is the centre: everything else may look in, it looks at nothing.',
      severity: 'error',
      from: { path: '^src/([^/]+)/domain/' },
      to: {
        path: '^src/$1/(database|infrastructure|commands|queries|application|dtos|guards|decorators|interceptors)/',
      },
    },
    {
      name: 'handlers-depend-on-port-not-adapter',
      comment:
        'Application and interface layers depend on the port, never on the concrete adapter (*.repository.ts, *.adapter.ts, *.gateway.ts). The adapter is chosen once, in the module.',
      severity: 'error',
      from: {
        path: '^src/[^/]+/(commands|queries|application)/',
        pathNot: TESTS,
      },
      to: {
        path: '\\.(repository|adapter|gateway)\\.ts$',
      },
    },
    {
      name: 'controllers-go-through-the-bus',
      comment:
        'An HTTP controller translates a request into a command or query and maps the result back. It does not reach for persistence — no repository, no port, no ORM model. If it needs data, it dispatches for it.',
      severity: 'error',
      from: { path: '\\.http\\.controller\\.ts$' },
      to: {
        path: '^src/[^/]+/database/',
        // A read model's shape may be named in a signature; what a controller
        // may not do is call persistence. Only runtime edges are the offence.
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'orm-entity-stays-in-database',
      comment:
        'TypeORM persistence models (*.orm-entity.ts) belong to the database layer. Outer layers use the domain entity instead. (The mapper and module wiring are exempt.)',
      severity: 'error',
      from: {
        path: '^src/[^/]+/(domain|commands|queries|dtos)/',
      },
      to: { path: '\\.orm-entity\\.ts$' },
    },
    {
      name: 'typeorm-stays-in-the-adapters',
      comment:
        'TypeORM is a detail of the persistence adapter. Everything inside it — including application-layer policies and resolvers — asks a repository port instead, so the store can change without them noticing.',
      severity: 'error',
      from: {
        path: '^src/[^/]+/(domain|commands|queries|application|dtos)/',
        // Ledger: these three read ORM repositories directly and still need a
        // port. All of them reach across into organizations'/roles' tables,
        // which is what makes the port worth defining rather than inlining.
        pathNot: [
          '^src/authz/application/active-organization\\.resolver\\.ts$',
          '^src/authz/application/principal-residency\\.policy\\.ts$',
          '^src/authz/application/scope\\.resolver\\.ts$',
        ],
      },
      to: { path: 'node_modules/(typeorm|@nestjs/typeorm)/' },
    },
    {
      name: 'better-auth-stays-behind-an-adapter',
      comment:
        'Better Auth owns the identity tables and is an external system like any other: it is reached through src/auth/infrastructure/ or a module’s own gateway, never imported into a handler or a controller.',
      severity: 'error',
      from: {
        path: '^src/',
        pathNot: [
          '^src/[^/]+/infrastructure/',
          '^src/[^/]+/[^/]+\\.module\\.ts$',
          '^src/app\\.module\\.ts$', // the composition root wires the provider
          // A guard is an inbound adapter, and these are the auth module's
          // own: authenticating a request is the integration this module
          // exists for. No other module's guards are admitted here.
          '^src/auth/guards/',
          ...TESTS,
          // The seed is a composition root of its own: a standalone script
          // that boots the same providers to write the first admin user.
          '^src/database/seed\\.ts$',
          // Ledger: the delegating façades that still call Better Auth from a
          // service or a mapper instead of a gateway. Cleared when admin/ and
          // organizations/ are cut into use-case slices over gateway ports.
          '^src/admin/admin\\.service\\.ts$',
          '^src/admin/admin\\.mappers\\.ts$',
          '^src/admin/admin-error\\.mapper\\.ts$',
          '^src/organizations/organizations\\.service\\.ts$',
          '^src/organizations/invitations\\.service\\.ts$',
          '^src/organizations/workspaces\\.service\\.ts$',
          '^src/organizations/organization\\.mappers\\.ts$',
          '^src/organizations/organization-error\\.mapper\\.ts$',
          // Ledger: profile's error mapper folds Better Auth's error codes onto
          // this module's catalog, which needs the invoker but is not itself an
          // adapter. It belongs beside the gateway once that file moves.
          '^src/profile/profile-error\\.mapper\\.ts$',
        ],
      },
      to: {
        path: [
          'node_modules/better-auth/',
          // The configured instance is the same dependency wearing a local
          // path. Without this the rule is vacuously true: nothing imports the
          // library directly, everything imports `auth` from here.
          '^src/auth/infrastructure/better-auth\\.config\\.ts$',
        ],
      },
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
    {
      name: 'no-cross-module-internals',
      comment:
        'A module publishes its domain, its DTOs, its ports, its DI tokens, its bus messages and its inbound adapters. Its handlers, controllers, mappers and concrete adapters are its own. Reaching past that surface couples two modules at the seam that is meant to be replaceable.',
      severity: 'error',
      from: {
        path: '^src/([^/]+)/',
        pathNot: [
          ...TESTS,
          // The seed is a composition root of its own: a standalone script
          // with no command bus, so it builds the handlers sign-up would have
          // dispatched and owes itself their side effects.
          '^src/database/seed\\.ts$',
        ],
      },
      to: {
        path: '^src/(?!$1/)[^/]+/',
        pathNot: CROSS_MODULE_PUBLIC_SURFACE,
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
