# Frontend Architecture — two splits, one direction

`packages/frontend` is what the four apps (`apps/web`, `apps/admin-web`,
`apps/mobile`, `apps/admin-mobile`) share below their routes. It is split
twice, and the two splits answer different questions.

This document is the source of truth for the tier. The machine-checked rules
in each package's `.dependency-cruiser.cjs` (built from
`packages/tsconfig/depcruise/*.cjs`), `scripts/check-frontend-structure.mjs` and
the scoped rule file `.agents/rules/frontend-architecture.md` enforce what is
described here. When they disagree, fix the code or update both together.

## The two splits

**By product, for logic.** An entity, a repository, a service or a query hook
belongs to a product or to both. `core` is the kernel every app loads:
session (`auth`), `users`, `user-settings`, `capabilities`, `analytics`, the
InversifyJS container (`OppenheimerApp`, `TOKENS`), `config/` and `validation/`.
`consumer` is the console's product — `sessions` and `hosts` — plus the
account chrome it keeps (`organizations` as the personal workspace, `profile`,
`api-tokens`); `admin` (`admin-users`, `roles`) is the control plane's. An app
loads exactly one, and the products never import each other.

**By platform, for UI and glue.** A component, a hook over a browser API, an
i18n bootstrap belong to web or to mobile. `web` is what both Vite apps share
(`shell`, `auth`, `table`, `layout`, `forms`, `theme`, `i18n`, `analytics`,
`platform`, `roles`); `mobile` is what both Expo apps share (`analytics`,
`config`, `forms`, `i18n`, `layout`, `platform`, `theme`). A kit is organised
by concern, each concern with the kind directories a feature has.

The split by product keeps `apps/web` from bundling the control plane's
modules, and the split by platform keeps `react-dom` out of the packages
`apps/mobile` loads. Logic is written once and runs on both platforms; UI is
written once per platform and serves both products.

```
packages/frontend/
├── core/        @oppenheimer/frontend-core      modules/ react/ di/ config/ validation/
├── consumer/    @oppenheimer/frontend-consumer  modules/ react/ di/
├── admin/       @oppenheimer/frontend-admin     modules/ react/ di/
├── api-client/  @oppenheimer/api-client         generated from the API's OpenAPI spec
├── web/         @oppenheimer/frontend-web       <concern>/{components,dialogs,hooks,lib}/
└── mobile/      @oppenheimer/frontend-mobile    <concern>/{components,hooks,lib}/
```

## The placement grid

| What it is | Used by | Goes in |
| --- | --- | --- |
| Logic: entity, repository, service, query hook | both products | `core` |
| Logic | one product | `consumer` or `admin` |
| UI or glue | both apps of a platform | `web` or `mobile` |
| A primitive with the same API on both platforms | | `packages/frontend/design-system/web` and `/mobile` |
| Everything else | one app | `apps/<app>/features/<module>/<kind>/` |

Two cells are never filled. **Logic in a platform kit**: mobile would have to
copy it, and the copies would drift; `kit-knows-no-product` and the kits'
dependency lists (the kernel only) hold this. **UI in a product package**: a
component needs `react-dom` or `react-native`, and a product package is loaded
by both platforms; `domain-knows-no-platform` holds this. When something seems
to need one of these cells it is two things glued together: the hook goes down
to a product package and the component sideways to the kit, and the feature
that needed both composes them.

## Dependency direction

```
                 @oppenheimer/shared          @oppenheimer/api-client
                       │                        │
                       └──────────┬─────────────┘
                                  ▼
                        @oppenheimer/frontend-core            design-system/<platform>
                                  │                              │
               ┌──────────────────┼──────────────────┐           │
               ▼                  │                  ▼           ▼
   @oppenheimer/frontend-consumer       │      @oppenheimer/frontend-admin   @oppenheimer/frontend-<platform>
               │                  │                  │           │
               └────────┐         │         ┌────────┘           │
                        ▼         ▼         ▼                    │
                  apps/web, apps/mobile  |  apps/admin-web, apps/admin-mobile
                        ▲                                        │
                        └────────────────────────────────────────┘

   shared ─► core ─► consumer | admin ─► apps
   design-system/<platform> ─► frontend/<platform> kit ─► apps
```

- A product package imports the kernel, `@oppenheimer/shared` and
  `@oppenheimer/api-client`. Never the other product, never a kit.
- A kit imports its design system and the kernel. Never a product, never an
  app. A component that needs a product hook is a feature, not kit.
- An app imports one product package, one kit and one design system, each by
  its package name.
- Inside a domain package, `modules/` never imports `react/`; the React
  bindings sit on top of the domain and read it through the container.

## How an app assembles itself

The app's `lib/oppenheimer.ts` is the composition root, and loading a product's
modules is what makes the app that product (`apps/web/src/lib/oppenheimer.ts`):

```ts
export const app = OppenheimerApp.create({
  apiBaseUrl,
  storage: new LocalStorageService(),      // from the kit
  authClient: webAuthClient,               // lib/auth-client.ts
  analytics: createWebAnalyticsClient(),   // from the kit
  modules: consumerModules,                // or adminModules
});
```

`OppenheimerApp` binds the kernel (`createCoreModule`, `AnalyticsModule`,
`AuthModule`, `CapabilitiesModule`, `UsersModule`, `UserSettingsModule`) and
then whatever `modules` the app passes. `OppenheimerProvider` puts the app in
context; `useOppenheimerApp()` reads it. The kernel only knows kernel services, so a
product resolves its own through a wrapper over the same container:
`ConsumerApp.for(app)` behind `useConsumerApp()`, `AdminApp.for(app)` behind
`useAdminApp()`. A product query hook reads `useConsumerApp().sessions`
the way a kernel hook reads `useOppenheimerApp().auth`.

The query cache follows the same shape. The kernel ships the persistence
policy (`defaultQueryClientOptions`, `createQueryPersistOptions`,
`shouldDehydrateQuery`); the app supplies the platform's persister and names
its product's sensitive features:

```ts
createQueryPersistOptions(__APP_VERSION__, {
  nonPersistedFeatures: CONSUMER_NON_PERSISTED_FEATURES,
});
```

On mobile the kit's `createQueryPersistence(config)` wraps that with an MMKV
persister and `expo-constants`' version.

## Where the products meet: kernel contracts

The products never import each other, so what they share is a kernel export,
not an import:

- `MEMBER_LISTS_KEY` (`core/src/react/query-keys.ts`) is the prefix of every
  organization member list. The admin product invalidates it in
  `useAssignUserRoles`, because a member list filtered by role is stale the
  moment a role changes hands; the consumer product lists no members today
  (workspaces are personal), and when the teams slice does, it lists them
  under this key.
- `KERNEL_NON_PERSISTED_FEATURES` names the features whose queries never
  reach storage whatever the product (`auth`, `userSettings`);
  `CONSUMER_NON_PERSISTED_FEATURES` adds the consumer's (`sessions`, `hosts`,
  `apiTokens`, `profile`), and the app passes it through `nonPersistedFeatures`.
- `user-settings` is a kernel module, not a consumer one, because both
  products apply the saved theme and locale on mount
  (`useApplyUserSettings` in the web kit reads `useUserSettings`).
- `TOKENS` in a product package spreads the kernel's, so a product service
  injects `TOKENS.AnalyticsService` and `TOKENS.OrganizationsRepository`
  through one object.

## Promotion paths

Nothing moves before its second consumer appears; nothing is written twice.

- **Feature → kit**: the second app on the platform needs the component or
  hook. It moves to the concern it belongs to, is exported from that
  concern's `index.ts`, and the feature imports it from the package name.
  `pnpm check:structure` rejects an app file whose basename the kit ships.
- **Kit → design system**: it is a primitive with the same API on both
  platforms (a button, a field, a dialog frame) and carries no product or
  kernel knowledge.
- **Product → kernel**: the second product needs the module or the query
  key. The module moves to `core/src/modules/`, its tokens to the kernel
  `TOKENS`, its getter to `OppenheimerApp`; a shared key alone goes to
  `core/src/react/query-keys.ts`.

## Add a module to a product package

`sessions` in `packages/frontend/consumer` is the reference. For a module
`things` in the consumer package:

1. `src/modules/things/thing.entity.ts` — plain classes with readonly fields,
   as the UI needs them (`OrganizationEntity`).
2. `src/modules/things/things.errors.ts` — client-side fallbacks, `as const
   satisfies Record<string, ErrorDefinition>`, codes `THINGS_CLIENT_001…`.
   They apply only when the API sent no problem document; `toAppError` keeps
   the server's `code` otherwise.
3. `src/modules/things/things.repository.ts` — `@injectable()`, calls
   `@oppenheimer/api-client` services, maps DTOs to entities, each method under
   `@MapApiError(ThingsErrors.X)`, throws `AppError` on an absent body.
4. `src/modules/things/things.service.ts` — `@injectable()`, injects the
   repository through `TOKENS.ThingsRepository`, holds the use cases.
5. `src/modules/things/things.module.ts` — a `ContainerModule` binding
   `TOKENS.ThingsRepository` and `TOKENS.ThingsService` in singleton scope.
6. `src/modules/things/index.ts` — export the entity, errors, module,
   repository and service; add `export * from './things'` to
   `src/modules/index.ts`.
7. `src/di/tokens.ts` — add `ThingsRepository` and `ThingsService` symbols
   next to the spread kernel `TOKENS`.
8. `src/di/consumer-app.ts` — push `ThingsModule` into `consumerModules` and
   add a `get things(): ThingsService` getter on `ConsumerApp`.
9. `src/react/things.queries.ts` — `thingsKeys` (every key derived from
   `all: ['things']`), query and mutation hooks over `useConsumerApp()`;
   mutations invalidate by prefix in `onSuccess`.
10. `src/react/index.ts` — export the keys and hooks by name.
11. If the module's data must never reach storage, add
    `thingsKeys.all[0]` to `CONSUMER_NON_PERSISTED_FEATURES` in
    `src/react/persistence.ts`.

Then `apps/web/src/features/things/` and `apps/mobile/features/things/` may
exist: `pnpm check:structure` allows a feature name only once a module of the
kernel or of the app's product package carries it. The admin package is the
same with `adminModules`, `AdminApp` and `useAdminApp()`.

## Add a concern to a kit

The kit's own `ARCHITECTURE.md` (`web/ARCHITECTURE.md`,
`mobile/ARCHITECTURE.md`) has the full cookbook. In short: create
`src/<concern>/` with only the kind directories it needs (`components/`,
`dialogs/`, `hooks/`, `lib/`), give it an `index.ts` that names what is
public, add `export * from './<concern>'` to `src/index.ts` (and a subpath in
`package.json` `exports` on mobile), and place the concern in one of the
`leaves`, `middle` or `top` lists of the kit's `.dependency-cruiser.cjs`.

## What the checkers enforce

`pnpm --filter <pkg> arch` runs dependency-cruiser with one of three factories
in `packages/tsconfig/depcruise/`.

`frontend-domain.cjs` (`core`, `consumer`, `admin`):

- `no-circular` — no import cycles.
- `domain-knows-no-react` — `src/modules/` never imports `src/react/`,
  `react` or `@tanstack/react-query`.
- `kernel-knows-no-product` (core) — the kernel imports neither product.
- `products-never-meet` (consumer, admin) — a product never imports the
  other; the meeting point is a kernel contract.
- `domain-knows-no-platform` — nothing imports a kit, `react-dom`,
  `react-native`, `expo-*` or `@tanstack/react-router`.

`frontend-kit.cjs` (`web`, `mobile`):

- `no-circular`.
- `leaves-stay-leaves` — a leaf concern never imports a middle or top one.
- `middle-below-top` — a middle concern never imports a top one.
- `concerns-meet-at-their-index` — a concern imports another only through
  that concern's `index.ts`.
- `lib-has-no-jsx` — a concern's `lib/` imports `react` for types only.
- `kit-knows-no-product` — nothing imports `consumer` or `admin`.
- `kit-knows-no-app` — nothing imports `apps/`.

`frontend-app.cjs` (the four apps): `no-circular`, `features-are-islands`,
`routes-compose`, `forms-and-components-stay-pure`, `lib-has-no-jsx`,
`one-product-per-app`, `kit-through-its-entry`. Their meaning is in
`.agents/rules/frontend-architecture.md`.

`pnpm check:structure` (`scripts/check-frontend-structure.mjs`) checks the
shapes the cruiser cannot: feature names against the module lists, kind
directories, the route line cap, app files the kit already ships, and that
every package here carries a `README.md`, an `AGENTS.md` linking a rule file,
and — for the tier and the kits — an `ARCHITECTURE.md`.
