---
sidebar_position: 2
---

# Frontend Architecture

`packages/frontend` is what the four apps (`apps/web`, `apps/admin-web`,
`apps/mobile`, `apps/admin-mobile`) share below their routes. It is split
twice, and the two splits answer different questions.

## The two splits

**By product, for logic.** An entity, a repository, a service or a query hook
belongs to one product or to both. **By platform, for UI and glue.** A
component, a hook over a browser API or an i18n bootstrap belongs to web or to
mobile.

| Package                   | Name                      | Holds                                                                                                  |
| ------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `packages/frontend/core`      | `@oppenheimer/frontend-core`      | The kernel every app loads: `auth`, `users`, `user-settings`, `capabilities`, `analytics`, the InversifyJS container (`OppenheimerApp`, `TOKENS`), `config/`, `validation/` |
| `packages/frontend/consumer`  | `@oppenheimer/frontend-consumer`  | The consumer product: `api-tokens`, `organizations`, `profile`                                        |
| `packages/frontend/admin`     | `@oppenheimer/frontend-admin`     | The control plane: `admin-users`, `roles`                                                             |
| `packages/frontend/api-client`| `@oppenheimer/api-client`         | The typed client generated from the API's OpenAPI spec                                                |
| `packages/frontend/web`       | `@oppenheimer/frontend-web`       | What both Vite apps share, by concern: `shell`, `auth`, `table`, `layout`, `forms`, `theme`, `i18n`, `analytics`, `platform`, `roles` |
| `packages/frontend/mobile`    | `@oppenheimer/frontend-mobile`    | What both Expo apps share: `analytics`, `config`, `forms`, `i18n`, `layout`, `platform`, `theme`       |

Imports run one way:

```
shared ─► core ─► consumer | admin ─► apps
design-system/<platform> ─► frontend/<platform> kit ─► apps
```

A product package imports the kernel, `@oppenheimer/shared` and `@oppenheimer/api-client`,
never the other product and never a kit. A kit imports its design system and
the kernel, never a product and never an app. An app imports exactly one
product package, one kit and one design system, each by its package name.
Inside a product package, `modules/` never imports `react/`: the React
bindings sit on top of the domain and read it through the container.

Two placements are never valid. Logic in a platform kit would have to be copied
for mobile; UI in a product package would pull `react-dom` or `react-native`
into a package both platforms load. Something that seems to need either is two
things glued together — the hook goes down to a product package, the component
sideways to the kit.

The split by product is also what keeps `apps/web` from bundling the control
plane's modules.

## Inside an app: routes compose, features contain

An app is its routes, its features and a small `lib/`. A feature is named after
a module of the kernel or of the app's product package (or one of the app's
allowlisted names, such as `dashboard` and `public` in `apps/web`), and holds
kind directories and nothing else:

```
features/<module>/
├── screens/      # what a route mounts; may fetch, may use the router
├── sections/     # a pane, a table, a card group; may fetch
├── dialogs/      # one dialog per file, owns its mutation; may fetch
├── forms/        # React Hook Form over a shared Zod schema; props in, onSubmit out; never fetches
├── components/   # entity UI: row, cell, pill, hero; props only; never fetches
├── hooks/        # use-*.ts; queries + UI state; the only place an effect lives
├── lib/          # types, mappers, config; no JSX
└── __tests__/
```

- A kind directory holds files, never a sub-directory. A feature that wants one
  is two features.
- Features never import each other. What two of them need moves to the kit when
  the second consumer appears.
- `forms/` and `components/` never import `@oppenheimer/frontend-*/react`,
  `@tanstack/react-query`, `@tanstack/react-router` or `expo-router`.
- A route file composes screens, sections and dialogs and stays under 120
  lines.
- There is no `index.ts` inside a feature; a route imports the screen by path.

## Render rules

- State lives in the lowest component that reads it; a page holds only what two
  siblings share.
- Subscribe at the leaf: `useWatch` and `useFormState` take `control` in the
  component that shows the value, and `select` narrows a query to what a row
  renders.
- One component per file.
- An effect synchronises with something outside React and says which system in
  a comment. It lives in a `hooks/` file. Never for deriving state, resetting
  on a prop change or fetching.
- The React Compiler is on in every app, so no manual `useMemo`, `useCallback`
  or `memo` outside `hooks/`.

## How an app assembles itself

`apps/<app>/src/lib/oppenheimer.ts` is the composition root, and the modules it loads
are what make the app one product or the other:

```typescript
export const app = OppenheimerApp.create({
  apiBaseUrl,
  storage: new LocalStorageService(),      // from the kit
  authClient: webAuthClient,               // lib/auth-client.ts
  analytics: createWebAnalyticsClient(),   // from the kit
  modules: consumerModules,                // or adminModules
});
```

`OppenheimerApp` binds the kernel's modules and then whatever `modules` the app
passes. `OppenheimerProvider` puts the app in context and `useOppenheimerApp()` reads it.
The kernel only knows kernel services, so a product resolves its own through a
wrapper over the same container: `useConsumerApp()` and `useAdminApp()`. A
product query hook reads `useConsumerApp().organizations` the way a kernel hook
reads `useOppenheimerApp().auth`.

The query cache follows the same shape. The kernel ships the policy
(`defaultQueryClientOptions`, `createQueryPersistOptions`,
`shouldDehydrateQuery`); the app supplies the platform's persister and names
its product's sensitive features:

```typescript
createQueryPersistOptions(__APP_VERSION__, {
  nonPersistedFeatures: CONSUMER_NON_PERSISTED_FEATURES,
});
```

See [React Query Keys](./query-keys.md) for the key convention and the
persistence policy.

## The checks

- `pnpm arch` — dependency-cruiser in every frontend package and app: no
  cycles, `domain-knows-no-react`, `products-never-meet`,
  `domain-knows-no-platform`, `kit-knows-no-product`, `features-are-islands`,
  `routes-compose`, `forms-and-components-stay-pure`, `one-product-per-app`.
- `pnpm check:structure` — feature names against the module lists, the kind
  directories, the route line cap, and app files whose basename the kit already
  ships.
- Biome — `useEffect` outside `hooks/`, nested component definitions, and the
  manual memo imports the React Compiler makes unnecessary.

The full rules are `.agents/rules/frontend-architecture.md` and
`packages/frontend/ARCHITECTURE.md`.

## Accounts, workspaces and invitations (web)

The consumer app's account flows sit under `apps/web/src/routes`:

| Route                     | What it does                                                                                                                                                                                           | Feature                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `/login`, `/register`     | Email/password plus the social providers the deployment exposes. Only `/register` passes the sign-up intent; a provider identity with no account here is refused on `/login` (`?error=signup_disabled`) and redirected to `/register`. | `features/auth`                |
| `/forgot-password`, `/reset-password` | Requests a reset link and consumes it; the link's `token` and any `error` come in through the search params.                                                                                | `features/auth`                |
| `/onboarding`             | Where a signed-in account with no workspace lands. It creates the first organization or accepts an invitation already addressed to the account. `_authenticated` redirects here once the organizations list resolves empty. | `features/organizations`       |
| `/accept-invitation`      | Invitation links carry `id`, `email`, `name`, `role` and `inviter`. A newcomer registers from the link and the acceptance completes in the same submission; an existing account signs in and is returned to the link. | `features/organizations`       |
| `/profile`                | The signed-in user's own account, as four panes: details, password, sessions and preferences. Theme and language apply to the device at once and the saved copy becomes the default elsewhere.        | `features/profile`             |
| `/settings`               | Three panes, with the open one in `?section=`: the workspace's name and mark (`general`), the reader's sessions (`security`), and their API keys (`api`).                                              | `features/organizations`, `features/profile`, `features/api-tokens` |
| `/oauth/consent`          | The consent screen an OAuth client is sent to.                                                                                                                                                         | `features/auth`                |

The sidebar and command palette are gated by the caller's permissions: each nav
row takes its policies from `ENDPOINT_POLICIES` in `@oppenheimer/shared/permissions`
— the same catalog the API's `@CheckPolicies` decorators are asserted against —
keyed by the endpoint that row's screen reads, so a route the caller cannot
open is never offered. The rows live in
`apps/web/src/lib/nav.ts`, and `useAuthorizedNav` and `useAbility` from
`@oppenheimer/frontend-web` filter them.
