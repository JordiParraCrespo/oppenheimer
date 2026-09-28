# @oppenheimer/frontend-core

The kernel every frontend app loads. It holds the logic that is not any one
product's — session, users, user settings, deployment capabilities, analytics —
as plain entities, repositories and services over `@oppenheimer/api-client`, plus
the React bindings that expose them as TanStack Query hooks. Nothing here is
platform code: no DOM, no router. It also owns the InversifyJS container
(`OppenheimerApp`, `TOKENS`) the product package extends, the query-cache
persistence policy, and the contracts a product builds on.

`react` and `@tanstack/react-query` are optional peer dependencies: import
`@oppenheimer/frontend-core/react` only from a React app.

## What it exports

`@oppenheimer/frontend-core` (`src/index.ts`) — `di` and `modules`. The barrels
export what an app imports; `pnpm check:unused` (knip) fails on an export
nothing imports, and a documented contract with no caller yet carries
`/** @public <why> */` on its line.

- **di** — `OppenheimerApp`, `OppenheimerAppConfig`, `TOKENS`.
- **modules/analytics** — `AnalyticsService`, `AnalyticsModule`,
  `ANALYTICS_EVENTS`, `sanitizeUrlProperties`, the `IAnalyticsClient` port.
- **modules/auth** — `AuthService`, `AuthModule`, the auth state types
  (`createAuthStore` is at `./state`), the `IAuthClient` port.
- **modules/capabilities** — `CapabilitiesService`, `CapabilitiesModule`.
- **modules/feature-flags** — `FeatureFlagsService`, `FeatureFlagsModule`, the
  `FeatureFlagsClientContext` an app passes to
  `OppenheimerApp.create({ featureFlags })`.
- **modules/core** — `AppError`, `MapApiError`, `unwrap` / `unwrapBody`,
  `createErrorMessageResolver`, the `IStorageService` port.
- **modules/user-settings** / **modules/users** — their service and module.
- **validation** (`./validation`) — `createZodErrorMap`,
  `ValidationMessageKey`.

`@oppenheimer/frontend-core/react` (`src/react/index.ts`):

- `OppenheimerProvider`, `useOppenheimerApp`, `useAuthState`.
- Session: `useLogin`, `useLogout`, `useSessionRestore`, `useSocialLogin`,
  `useForgotPassword`, `useResetPassword`, `useExpireSession`.
- Users: `useProfile`, `useMyPermissions`, `usersKeys`.
- Settings: `useUserSettings`.
- Analytics: `usePageView`; `useCaptureEvent` and `useCaptureOnMount`, the
  documented way to capture a product event.
- Feature flags: `useFeatureFlag`, `useFeatureFlagValue`, `useFeatureFlags`.
  Values come from the API, typed by the catalog in
  `@oppenheimer/shared/feature-flags`; see `.agents/rules/feature-flags.md`.
- Capabilities: `useDeploymentCapabilities`.
- Queries and mutations: `useQuery` / `useQueries` (entities shared across
  refetches), `withCacheOnSuccess`, `refetchEverythingForNewIdentity`.
- Cache policy: `createQueryClient`, `defaultQueryClientOptions`,
  `createQueryPersistOptions`.

## How to use it

`apps/web/src/lib/oppenheimer.ts` builds the container; the app's product package
supplies `modules`:

```ts
import { consumerModules } from '@oppenheimer/frontend-consumer';
import { OppenheimerApp } from '@oppenheimer/frontend-core';
import { createWebAnalyticsClient, LocalStorageService } from '@oppenheimer/frontend-web';
import { webAuthClient } from './auth-client';

export const app = OppenheimerApp.create({
  apiBaseUrl: import.meta.env.VITE_API_URL ?? '',
  storage: new LocalStorageService(),
  authClient: webAuthClient,
  analytics: createWebAnalyticsClient(),
  modules: consumerModules,
});
```

`OppenheimerProvider` puts it in context (`apps/web/src/providers/oppenheimer-provider.tsx`)
and a screen reads a hook: `const login = useLogin()` in
`apps/web/src/features/auth/screens/login.tsx`.

## How to run it

```bash
pnpm --filter @oppenheimer/frontend-core lint    # biome check src/
pnpm --filter @oppenheimer/frontend-core test    # vitest run
pnpm --filter @oppenheimer/frontend-core arch    # dependency-cruiser
pnpm --filter @oppenheimer/frontend-core build   # tsc -> dist, what the apps consume
```

## Depends on / used by

Depends on `@oppenheimer/api-client`, `@oppenheimer/shared`, `inversify`, `zustand`,
`better-auth` and `@tanstack/query-core`. Used by
`@oppenheimer/frontend-consumer`, `@oppenheimer/frontend-web` and `apps/web`.
