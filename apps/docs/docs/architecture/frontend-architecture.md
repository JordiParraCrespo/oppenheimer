---
sidebar_position: 2
---

# Frontend Architecture

The `packages/frontend` package implements a clean architecture pattern shared between web and mobile.

## Layers

### Domain

Pure business logic with no framework dependencies:

- **Entities**: `UserEntity`, etc.
- **Repository interfaces**: `IAuthRepository`, `IUserRepository`
- **Service interfaces**: `IStorageService`

### Presentation

UI-agnostic state management:

- **Stores**: Zustand vanilla stores (framework-agnostic)
- **View Models**: Orchestrate use cases, manage store state

### Data Access

Concrete implementations:

- **Repositories**: API calls via `@oppenheimer/api-client`
- **Services**: Platform-specific (localStorage on web, SecureStore on mobile)

## Dependency Injection

InversifyJS wires everything together. Each app (web/mobile) binds its own implementations:

```typescript
import { container, TOKENS } from "@oppenheimer/frontend/di";
import { AuthRepositoryImpl } from "@oppenheimer/frontend";

// Bind platform-specific storage
container.bind(TOKENS.StorageService).to(WebStorageService);

// Bind shared implementations
container.bind(TOKENS.AuthRepository).to(AuthRepositoryImpl);
```

## Server state

Server state is handled with TanStack Query. Query keys follow a colocated
**query key factory** pattern, and the cache is persisted to `localStorage`
(web) / `AsyncStorage` (mobile) under a shared policy exported from
`@oppenheimer/frontend/react` — see [React Query Keys](./query-keys.md).

## Accounts, workspaces and invitations (web)

The web app's account flows all sit under `apps/web/src/routes`:

| Route                 | What it does                                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`, `/register` | Email/password plus the social providers the deployment exposes. Only `/register` passes `requestSignUp`; a provider identity with no account here is refused on `/login` (`?error=signup_disabled`) and forwarded to `/register`. |
| `/onboarding`         | Where a signed-in account with **no workspace** lands. It creates the first organization (`POST /v1/organizations`, which makes the caller its owner) or accepts an invitation already addressed to the account. `_authenticated` redirects here whenever the organizations list resolves empty. |
| `/accept-invitation`  | Invitation links carry `id`, `email`, `role` and `inviter`. A newcomer registers from the link and the acceptance completes in the same submission; an existing account signs in and is returned to the same link. |
| `/profile`            | The signed-in user's own account: details, password, sessions and preferences (`/v1/profile/*`). Preferences (`GET`/`PUT /v1/profile/settings`, a full replace) save on change; theme and language apply to the device at once and the saved copy becomes the default on any device that has not chosen for itself (`lib/use-apply-user-settings.ts`). |
| `/team`               | Members and invitations (`/v1/organizations/:orgId/members`, `/invitations`) and the role catalog (`/v1/roles`, `PUT /v1/users/:userId/roles`).       |
| `/settings`           | The workspace's name and mark, the reader's sessions, and their API keys. The open section lives in `?section=`.                                     |

The sidebar and command palette are gated by `GET /v1/users/me/permissions`:
each nav row takes its policies from `SCREENS` in `@oppenheimer/shared/navigation`,
the same catalog the API's `@CheckPolicies` decorators are asserted against, so
a route the caller cannot open is never offered (`components/app-shell/nav.ts`,
`lib/use-ability.ts`).

