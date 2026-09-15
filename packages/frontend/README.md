# @oppenheimer/frontend

Platform-agnostic frontend core shared by `apps/web` and `apps/mobile`. Business
logic, server-state, and auth live here — not in the app UIs — so both platforms
behave identically. Web and mobile only provide the presentation layer and inject
platform-specific implementations through the DI container.

## Architecture

Clean architecture, organized by module (`src/modules/{auth,users,core}`):

```
domain        → entities, use cases, ports (interfaces)
data-access   → adapters over @oppenheimer/api-client, better-auth
presentation  → framework-agnostic view models / query hooks
```

- **DI**: InversifyJS. `OppenheimerApp` composes the container from a `OppenheimerAppConfig`;
  `TOKENS` are the injection keys. Platform-specific adapters (storage, etc.) are
  bound by each app.
- **State**: Zustand _vanilla_ stores, shared across web and mobile.
- **Server state**: TanStack Query (`@tanstack/query-core`), exposed as React
  hooks under `./react`. `./react` also exports the shared cache-persistence
  policy (`defaultQueryClientOptions`, `createQueryPersistOptions`,
  `shouldDehydrateQuery`) that both apps feed to `PersistQueryClientProvider`.
- **Auth**: `better-auth`.

## Exports

| Export path             | Contents                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `@oppenheimer/frontend`       | Barrel re-export of DI + modules + React bindings                                    |
| `@oppenheimer/frontend/di`    | `OppenheimerApp`, `OppenheimerAppConfig`, `TOKENS`                                               |
| `@oppenheimer/frontend/react` | `OppenheimerProvider` + query hooks (`useProfile`, `useLogin`, `useLogout`, `useUsers`, …) |
| `@oppenheimer/frontend/state` | Auth Zustand store                                                                   |

`react` and `@tanstack/react-query` are **optional** peer dependencies — import
`@oppenheimer/frontend/react` only from a React app.

## Usage

```tsx
import { useProfile, useLogout } from "@oppenheimer/frontend/react";

const { data: user } = useProfile();
```

## Scripts

```bash
pnpm build       # tsc -> dist
pnpm dev         # tsc --watch
pnpm test        # vitest run
pnpm lint        # biome check src/
```

## Consumed by

`apps/web`, `apps/mobile`.
