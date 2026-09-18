# @oppenheimer/auth

Shared Better Auth configuration — the pieces the NestJS API and the web/mobile
clients must agree on, defined once.

## What lives here

| Export                      | Entry              | Used by                                                                |
| --------------------------- | ------------------ | ---------------------------------------------------------------------- |
| `userAdditionalFields`      | `.` and `./client` | Server `user.additionalFields` + client `inferAdditionalFields`        |
| `organizationSharedOptions` | `.` and `./client` | Server `organization()` + client `organizationClient()` (`teams` flag) |
| `sharedClientPlugins()`     | `./client`         | Web and mobile `createAuthClient` calls                                |
| `unwrap()`                  | `.` and `./client` | `IAuthClient` adapters (normalise `{ data, error }` results)           |
| `toAuthSession()`           | `.` and `./client` | `IAuthClient.getSession` adapters                                      |

Platform-specific pieces stay in the apps: the Expo plugin and SecureStore in
`apps/mobile`, cookie handling in `apps/web`, and everything server-only
(database, hooks, email, OAuth providers, admin roles) in
`apps/api/src/auth/infrastructure/better-auth.config.ts`. The `IAuthClient` boundary itself remains in
`@oppenheimer/frontend`.

## Two entry points, two build modes

- **`@oppenheimer/auth`** (root) — compiled CJS + `.d.ts`, like the other backend
  packages. Consumed by the NestJS API, whose `tsc` build cannot compile
  TypeScript sources out of `node_modules`. It only exports plain, explicitly
  typed values, so nothing is lost in declaration emit.
- **`@oppenheimer/auth/client`** — **ships TypeScript sources, deliberately.**
  Better Auth derives the client's endpoint and session types from the plugin
  tuple via inference chains that do not survive a `.d.ts` rollup. Vite (web)
  and Metro (mobile) transpile workspace TS sources natively, so the inferred
  types flow intact into each app's `createAuthClient` call. Do not add a
  build step for this entry.

## Usage

Server (`apps/api`):

```ts
import { organizationSharedOptions, userAdditionalFields } from "@oppenheimer/auth";

betterAuth({
  user: { additionalFields: userAdditionalFields },
  plugins: [
    organization({
      teams: {
        ...organizationSharedOptions.teams,
        allowRemovingAllTeams: false,
      },
      // ...server-only options
    }),
  ],
});
```

Clients (`apps/web`, `apps/mobile`):

```ts
import { sharedClientPlugins, toAuthSession, unwrap } from "@oppenheimer/auth/client";

const authClient = createAuthClient({
  baseURL: `${apiBaseUrl}/api/auth`,
  plugins: [
    /* platform plugins, e.g. expoClient(...) */ ...sharedClientPlugins(),
  ],
});
```
