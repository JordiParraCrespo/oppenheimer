---
sidebar_position: 2
---

# Frontend Architecture

`packages/frontend` is what the console (`apps/web`) loads below its routes.
It is split twice, and the two splits answer different questions.

## The two splits

**By product, for logic.** An entity, a repository, a service or a query hook
belongs to the kernel every app loads or to the product the app is. **By
platform, for UI and glue.** A component, a hook over a browser API or an i18n
bootstrap belongs to the platform kit.

| Package                   | Name                      | Holds                                                                                                  |
| ------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `packages/frontend/core`      | `@oppenheimer/frontend-core`      | The kernel: `auth`, `users`, `user-settings`, `capabilities`, `analytics`, the InversifyJS container (`OppenheimerApp`, `TOKENS`), `config/`, `validation/` |
| `packages/frontend/consumer`  | `@oppenheimer/frontend-consumer`  | The product: `sessions`, `hosts`, `installations`, and the account chrome (`organizations`, `profile`, `api-tokens`) |
| `packages/frontend/api-client`| `@oppenheimer/api-client`         | The typed client generated from the API's OpenAPI spec                                                |
| `packages/frontend/web`       | `@oppenheimer/frontend-web`       | The web platform kit, by concern: `shell`, `auth`, `table`, `layout`, `forms`, `theme`, `i18n`, `analytics`, `platform`, `roles`, `hosts` |

Imports run one way:

```
shared ─► core ─► consumer ─► apps/web
design-system/web ─► frontend/web kit ─► apps/web
```

A product package imports the kernel, `@oppenheimer/shared` and `@oppenheimer/api-client`,
never a kit. A kit imports its design system and the kernel, never a product
and never an app. An app imports exactly one product package, one kit and one
design system, each by its package name. Inside a product package, `modules/`
never imports `react/`: the React bindings sit on top of the domain and read it
through the container.

Two placements are never valid. Logic in the platform kit belongs to no
product and cannot be tested without a DOM; UI in a product package would pull
`react-dom` into code that has no platform. Something that seems to need either
is two things glued together — the hook goes down to the product package, the
component sideways to the kit.

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
  `@tanstack/react-query` or `@tanstack/react-router`.
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
are what make the app the product it is:

```typescript
export const app = OppenheimerApp.create({
  apiBaseUrl,
  storage: new LocalStorageService(),      // from the kit
  authClient: webAuthClient,               // lib/auth-client.ts
  analytics: createWebAnalyticsClient(),   // from the kit
  modules: consumerModules,                // the product package
});
```

`OppenheimerApp` binds the kernel's modules and then whatever `modules` the app
passes. `OppenheimerProvider` puts the app in context and `useOppenheimerApp()` reads it.
The kernel only knows kernel services, so a product resolves its own through a
wrapper over the same container: `useConsumerApp()`. A
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
