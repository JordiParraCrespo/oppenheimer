# @oppenheimer/frontend-consumer

The consumer product's domain, on top of the kernel. `sessions` (a worktree
with a terminal on a host), `projects` (the bodies of work sessions belong
to, with the defaults New session is prefilled with) and `hosts` (the
machines the user owns) are the product; `organizations` (the personal workspace only — no roster, no
members, no invitations, see `product/versions/mvp/08-auth.md`), `profile`
and `api-tokens` are the account chrome it keeps. Each module is an entity, an
error catalog, a repository over `@oppenheimer/api-client`, a service and an
InversifyJS `ContainerModule`; `src/react/` turns those services into
TanStack Query hooks. Like the kernel it is platform-free: no DOM, no router,
no platform kit.

An app becomes the consumer product by loading `consumerModules` into
`OppenheimerApp.create({ modules })`.

## What it exports

`@oppenheimer/frontend-consumer` (`src/index.ts`):

- **di** — `ConsumerApp`, `consumerModules`, `TOKENS` (the kernel's `TOKENS`
  spread, plus `HostsRepository`, `HostsService`, `ProjectsRepository`,
  `ProjectsService`, `SessionsRepository`, `SessionsService`, `OrganizationsRepository`, `OrganizationsService`,
  `ProfileRepository`, `ProfileService`, `ApiTokensRepository`,
  `ApiTokensService`).
- **modules/hosts** — `HostEntity`, `HostPairing`, `HostState`,
  `HostsService`, `HostsRepository`, `HostsModule`, `HostsErrors`.
- **modules/projects** — `ProjectEntity`, `ProjectRepository`,
  `CreateProjectInput`, `UpdateProjectInput`, `ProjectRepositoryInput`,
  `shortName`, `ProjectsService`, `ProjectsRepository`, `ProjectsModule`,
  `ProjectsErrors`.
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
  `CurrentCredential`, `PermissionCatalog`, `ApiTokensService`,
  `ApiTokensRepository`, `ApiTokensModule`, `ApiTokensErrors`.

`@oppenheimer/frontend-consumer/react` (`src/react/index.ts`):

- `useConsumerApp` — the product's services off the kernel container.
- Hosts: `useHosts`, `usePairHost`, `useRemoveHost`, `hostsKeys`.
- Projects: `useProjects`, `useCreateProject`, `useUpdateProject`,
  `useArchiveProject`, `projectsKeys`.
- Sessions: `useSessions`, `useSession`, `useCreateSession`,
  `useStopSession`, `sessionsKeys`, `useSessionStream` (a stable factory
  over `openStream`, for the effect that mounts a terminal).
- Organizations (personal workspace only): `useOrganizations`,
  `useCreateOrganization`, `useUpdateOrganization`, `organizationsKeys`.
- Profile: `useMyProfile`, `useUpdateMyProfile`, `useChangeOwnPassword`,
  `useUploadAvatar`, `useDeleteAvatar`, `useProfileSessions`,
  `useRevokeProfileSession`, `useRevokeOtherProfileSessions`, `profileKeys`.
- API tokens: `useApiTokens`, `useCreateApiToken`, `useRevokeApiToken`,
  `useCurrentCredential`, `usePermissionCatalog`, `apiTokensKeys`.
- Sign-up: `useRegister` (only this product has a registration flow).
- `CONSUMER_NON_PERSISTED_FEATURES` — the feature prefixes an app keeps out
  of the persisted query cache.

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
