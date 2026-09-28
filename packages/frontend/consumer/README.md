# @oppenheimer/frontend-consumer

The consumer product's domain, on top of the kernel. `sessions` (a worktree
with a terminal on a host), `projects` (the bodies of work sessions belong
to, with the defaults New session is prefilled with) and `hosts` (the
machines the user owns) are the product; `organizations` (the personal workspace only — no roster, no
members, no invitations, see `product/versions/mvp/08-auth.md`), `profile`
and `api-tokens` are the account chrome it keeps. Each module is an entity, an
error catalog, a repository over `@oppenheimer/api-client` and an InversifyJS
`ContainerModule`, plus a service where there is a use case to hold (sessions,
organizations, profile); `src/react/` turns `app.<module>` — the service, or
the repository when there is none — into
TanStack Query hooks. Like the kernel it is platform-free: no DOM, no router,
no platform kit.

An app becomes the consumer product by loading `consumerModules` into
`OppenheimerApp.create({ modules })`.

## What it exports

`@oppenheimer/frontend-consumer` (`src/index.ts`):

- **di** — `ConsumerApp`, `consumerModules`, `TOKENS` (the kernel's `TOKENS`
  spread, plus a `<Module>Repository` per module and `SessionsService`,
  `OrganizationsService`, `ProfileService`).
- **modules/hosts** — `HostEntity`, `HostPairing`, `HostState`,
  `HostsRepository`, `HostsModule`, `HostsErrors`.
- **modules/projects** — `ProjectEntity`, `ProjectRepository`,
  `CreateProjectInput`, `UpdateProjectInput`, `ProjectRepositoryInput`,
  `shortName`, `ProjectsRepository`, `ProjectsModule`, `ProjectsErrors`.
- **modules/installations** and **modules/automations** — their entities,
  `InstallationsRepository` / `AutomationsRepository`, modules and errors.
- **modules/sessions** — `SessionEntity`, `CreateSessionInput`,
  `SessionAgent`, `SessionState`, `SessionsService`, `SessionsRepository`,
  `SessionsModule`, `SessionsErrors`, `isSessionNotFound`. The terminal's
  transport lives here too, with no platform in it:
  `SessionsService.openStream(id, window)` returns a `SessionStream` (the
  attach socket, its reconnect ladder, a fresh ticket per dial and the
  byte credit). `createResizeCoalescer` and `FakeSessionStream` sit
  beside it. The app only renders what the stream delivers.
- **modules/organizations** — `OrganizationEntity`, `OrganizationsService`,
  `OrganizationsRepository`, `OrganizationsModule`, `OrganizationsErrors`.
- **modules/profile** — `ProfileEntity`, `UserSessionEntity`,
  `ProfileService`, `ProfileRepository`, `ProfileModule`, `ProfileErrors`.
- **modules/api-tokens** — `ApiTokenEntity`, `CreatedApiToken`,
  `CurrentCredential`, `PermissionCatalog`, `ApiTokensRepository`,
  `ApiTokensModule`, `ApiTokensErrors`.

`@oppenheimer/frontend-consumer/react` (`src/react/index.ts`):

The TanStack Query hooks and key factories for each module above — one
`<module>.queries.ts` per module, a `use…` hook per read or write and a
`<module>Keys` factory — plus `useConsumerApp`, the product's modules off
the kernel container, and `CONSUMER_NON_PERSISTED_FEATURES`, the prefixes an
app keeps out of the persisted query cache. The barrel is the catalog; it is
not repeated here.

## How to use it

`apps/web/src/routes/_authenticated.tsx` reads the workspace list the shell
names:

```tsx
import { useOrganizations } from '@oppenheimer/frontend-consumer/react';

const organizations = useOrganizations();
const organization = organizations.data?.[0];
```

`apps/web/src/providers/query-provider.tsx` names the features that never
reach the persisted cache:

```ts
import { CONSUMER_NON_PERSISTED_FEATURES } from '@oppenheimer/frontend-consumer/react';

...createQueryPersistOptions(__APP_VERSION__, {
  nonPersistedFeatures: CONSUMER_NON_PERSISTED_FEATURES,
}),
```

## How to run it

```bash
pnpm --filter @oppenheimer/frontend-consumer lint
pnpm --filter @oppenheimer/frontend-consumer test
pnpm --filter @oppenheimer/frontend-consumer arch
pnpm --filter @oppenheimer/frontend-consumer build   # tsc -> dist, what the apps consume
```

## Depends on / used by

Depends on `@oppenheimer/frontend-core`, `@oppenheimer/api-client`, `@oppenheimer/shared` and
`inversify`. Used by `apps/web`.
