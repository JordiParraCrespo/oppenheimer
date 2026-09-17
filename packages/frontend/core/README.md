# @oppenheimer/frontend-core

The kernel every frontend app loads. It holds the logic both products share —
session, users, user settings, deployment capabilities, analytics — as plain
entities, repositories and services over `@oppenheimer/api-client`, plus the React
bindings that expose them as TanStack Query hooks. Nothing here is web or
mobile: no DOM, no React Native, no router, so `apps/web`, `apps/admin-web`,
`apps/mobile` and `apps/admin-mobile` all run the same code. It also owns the
InversifyJS container (`OppenheimerApp`, `TOKENS`) the product packages extend, the
query-cache persistence policy, and the contracts the two products meet on.

`react` and `@tanstack/react-query` are optional peer dependencies: import
`@oppenheimer/frontend-core/react` only from a React app.

## What it exports

`@oppenheimer/frontend-core` (`src/index.ts`) — `config`, `di` and `modules`:

- **di** — `OppenheimerApp`, `OppenheimerAppConfig`, `TOKENS`.
- **modules/analytics** — `AnalyticsService`, `AnalyticsModule`,
  `NoopAnalyticsClient`, `ANALYTICS_EVENTS`, `isFlagEnabled`,
  `sanitizeUrlProperties`, the `IAnalyticsClient` port.
- **modules/auth** — `AuthService`, `AuthRepository`, `AuthModule`,
  `AuthErrors`, `createAuthStore` (also at `./state`), the `IAuthClient` port.
- **modules/capabilities** — `CapabilitiesService`, `CapabilitiesRepository`,
  `CapabilitiesModule`, `CapabilitiesErrors`.
- **modules/core** — `createCoreModule`, `AppError`, `toAppError`,
  `MapApiError`, `createErrorMessageResolver`, the `IStorageService` port.
- **modules/user-settings** / **modules/users** — `UserSettingsEntity`,
  `UserEntity` and their service, repository, module and errors.
- **config** (`./config`) — `ConfigManager`, `deepMerge`, `getAttribute`.
- **validation** (`./validation`) — `createZodErrorMap`,
  `ValidationMessageKey`.

`@oppenheimer/frontend-core/react` (`src/react/index.ts`):

- `OppenheimerProvider`, `useOppenheimerApp`, `useAuthState`.
- Session: `useLogin`, `useLogout`, `useSessionRestore`, `useSocialLogin`,
  `useForgotPassword`, `useResetPassword`, `useChangePassword`, `authKeys`.
- Users: `useProfile`, `useUser`, `useUsers`, `useUpdateUser`, `useDeleteUser`,
  `useMyPermissions`, `usersKeys`.
- Settings: `useUserSettings`, `useUpdateUserSettings`, `userSettingsKeys`.
- Analytics: `useAnalytics`, `useCaptureEvent`, `usePageView`,
  `useFeatureFlag`, `useFeatureFlags`, `analyticsKeys`.
- Capabilities: `useDeploymentCapabilities`, `capabilitiesKeys`.
- Cache policy: `defaultQueryClientOptions`, `createQueryPersistOptions`,
  `shouldDehydrateQuery`, `KERNEL_NON_PERSISTED_FEATURES`, `cacheOwnerKey`.
- Contracts both products use: `MEMBER_LISTS_KEY`, `withFeaturePrefix`.

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
`@oppenheimer/frontend-consumer`, `@oppenheimer/frontend-admin`, `@oppenheimer/frontend-web`,
`@oppenheimer/frontend-mobile` and all four frontend apps.
