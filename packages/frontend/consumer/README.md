# @oppenheimer/frontend-consumer

The consumer product's domain, on top of the kernel. It holds what
`apps/web` and `apps/mobile` need and the control plane does not:
organizations (workspaces, members, invitations), the signed-in person's
profile and sessions, and API tokens. Each module is an entity, an error
catalog, a repository over `@oppenheimer/api-client`, a service and an InversifyJS
`ContainerModule`; `src/react/` turns those services into TanStack Query
hooks. Like the kernel it is platform-free — the same code runs in the Vite
app and the Expo app — and it never imports `@oppenheimer/frontend-admin`.

An app becomes the consumer product by loading `consumerModules` into
`OppenheimerApp.create({ modules })`.

## What it exports

`@oppenheimer/frontend-consumer` (`src/index.ts`):

- **di** — `ConsumerApp`, `consumerModules`, `TOKENS` (the kernel's `TOKENS`
  spread, plus `OrganizationsRepository`, `OrganizationsService`,
  `ProfileRepository`, `ProfileService`, `ApiTokensRepository`,
  `ApiTokensService`).
- **modules/organizations** — `OrganizationEntity`,
  `OrganizationMemberEntity`, `OrganizationInvitationEntity`,
  `OrganizationsService`, `OrganizationsRepository`, `OrganizationsModule`,
  `OrganizationsErrors`, `MemberFilters`.
- **modules/profile** — `ProfileEntity`, `UserSessionEntity`,
  `ProfileService`, `ProfileRepository`, `ProfileModule`, `ProfileErrors`.
- **modules/api-tokens** — `ApiTokenEntity`, `CreatedApiToken`,
  `CurrentCredential`, `PermissionCatalog`, `ApiTokensService`,
  `ApiTokensRepository`, `ApiTokensModule`, `ApiTokensErrors`.

`@oppenheimer/frontend-consumer/react` (`src/react/index.ts`):

- `useConsumerApp` — the product's services off the kernel container.
- Organizations: `useOrganizations`, `useCreateOrganization`,
  `useUpdateOrganization`, `useOrganizationMembers`,
  `useRemoveOrganizationMember`, `useUpdateOrganizationMemberRole`,
  `useInviteMembers`, `useOrganizationInvitations`,
  `useCancelOrganizationInvitation`, `useMyInvitations`,
  `useAcceptInvitation`, `organizationsKeys`.
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

`apps/mobile/lib/query.ts` names the features that never reach the on-device
cache:

```ts
import { CONSUMER_NON_PERSISTED_FEATURES } from '@oppenheimer/frontend-consumer/react';

export const { queryClient, persistOptions } = createQueryPersistence({
  nonPersistedFeatures: CONSUMER_NON_PERSISTED_FEATURES,
});
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
`inversify`. Used by `apps/web` and `apps/mobile`. Never used by
`apps/admin-web` or `apps/admin-mobile`, which load `@oppenheimer/frontend-admin`.
