# @oppenheimer/api

## 0.3.0

### Minor Changes

- ed28ce2: A runner's refusal of a session command is recorded on the session's log, so a start the host refuses fails instead of staying `starting`; adding a second repository to a session is `SESSIONS_010`.
- 51c52fd: Credential kinds are now contributed to the auth kernel with `AuthModule.contributeCredentials`, so `auth` no longer imports the modules built on it.
- f099524: Adopt the authorization kernel. A route that declares no policy no longer admits any authenticated caller, and two tenants can both define a `manager` role.
- 7ff8b30: `@oppenheimer/backend-llm`: one `complete()` client over several LLM providers;
  the API binds it from `LLM_*`.

  Sessions are named from their first prompt: a model with a short deadline,
  otherwise the prompt's own words. `SESSION_NAMER_PROVIDER`,
  `SESSION_NAMER_BASE_URL`, `SESSION_NAMER_API_KEY` and `ANTHROPIC_API_KEY` are gone.

- 64d3f7a: Remove the Stripe `billing` module and the `leads` example the project
  inherited from the Flama starter. Neither was ever composed into the API, so no
  endpoint a deployment served goes away; what goes is everything that existed
  only for them. Stripe billing can be brought back from the Flama starter's
  `billing` plugin, then `pnpm generate:api-client`.

  These are breaking changes for anything that imported the removed names, which
  is why the packages below take a minor bump while they are on 0.x.

  - `@oppenheimer/api` drops `src/billing`, `src/leads`, the `stripe` config and
    the `stripe` dependency, and the `stripe_billing` capability (and with it the
    property on `GET /health/capabilities`). A new migration,
    `1789600000000-DropBillingAndLeads`, drops the `lead`, `subscription` and
    `billing_customer` tables, which nothing ever wrote; the migrations that
    created them stay, since deployed databases have run them. The `STRIPE_*`
    variables leave `.env.example`.
  - `@oppenheimer/shared` drops the `billing` and `leads` scope resources and
    permission groups (so the `billing:*` and `leads:*` scopes), the
    `stripe_billing` deployment and client capability, the `Billing` subject, the
    `GET /billing/subscriptions` endpoint policy and the billing and lead schemas.
  - `@oppenheimer/api-client` drops the legacy `BillingApi` and `LeadsApi`
    services and their models, and the regenerated types no longer carry the
    removed scopes or `stripe_billing`.
  - `@oppenheimer/translations` drops the `BILLING_*` and `LEAD_*` error copy and
    the unused billing entry of the team page's permission areas.
  - `@oppenheimer/backend-core`: the capabilities registry's docs no longer use
    Stripe as their example.

- f099524: An optional feature is enabled by its config being present rather than by a `'not-set'` sentinel, and `GET /health/capabilities` serves the client-facing set.
- f099524: New `AuthErrors`, `OrganizationErrors` and `AdminErrors` catalogs; `betterAuthInvoker` folds Better Auth's upstream codes onto them, and the guards throw catalog errors — a missing principal is now 401 rather than 403.
- a880b19: Connecting a host is hardened. An unpaired host is refused a link and stops dialling. The pairing-token cap holds under concurrent mints, and `POST /v1/hosts/pairing` takes `replaces` to retire the token on screen in the same write. The owner is emailed when a machine pairs. The agent prompt is a short template around the install command. `runner uninstall --force` keeps the pairing when a session cannot be ended, and a re-run of the installer restarts the systemd unit on the new release.
- 79e30e5: Add the `github/` module: connect and disconnect a GitHub App installation, list what it covers live from GitHub, and mint a one-hour token narrowed to one repository. One table, `github_installation`, and no repository table — the installation is the allowlist and GitHub enforces it. `POST /installations` proves the caller can see the installation it claims by exchanging the OAuth code from the same redirect. The six `GITHUB_APP_*` settings are optional and surface as the `github_app` capability.
- 8e2de68: Add `hosts/`: pairing tokens, host registration, and the host's boot assertion
  as the `host` credential kind this module contributes to the auth kernel with
  `AuthModule.contributeCredentials`.
- 5bd4a8b: New session sets how a session is launched, and `POST /sessions` takes it.

  The route grows a `launch` object — model, permission level, effort — and the
  `prompt` typed into the composer. The launch is folded onto `work_session` so a
  restart can relaunch a session the way it was launched without walking its log.
  The prompt is a log entry and rides `session.create` to the host, where it
  becomes the agent's trailing argument rather than something typed at a running
  terminal — so nothing about the composer waits on the relay, and exactly one of
  the two ends ever writes `prompt.first`. It also names the session, through a
  new `openai-compatible` namer provider that covers Groq, Together, vLLM and a
  local Ollama.

  The agent catalog in `@oppenheimer/shared` grows each agent's models and the
  argv its permission levels, effort stops and first task map to, read off
  claude 2.1.278's and codex-cli 0.155.1's own `--help`.

  **Breaking, `@oppenheimer/frontend-consumer`:** `SessionEntity` was modelling one
  repository, one branch and a `running | idle | stopped` state the control plane
  had stopped sending. It carries `checkouts`, the derived `state` group and the
  stored `lifecycle` now, and `create` takes an idempotency key from its caller.

- f099524: Domain events and queued jobs are staged in the same transaction as the write that owes them, so a crash between commit and dispatch no longer drops them.
- f099524: Sign-up grants the default role and provisions the personal workspace through domain use cases rather than SQL in a Better Auth hook. A slug with no URL-safe characters falls back to `workspace-…` everywhere, and `ROLE_007` replaces a bare 500 when a system role is missing.
- 8d78094: Add the `projects/` module: `GET /v1/projects`, `GET /v1/projects/{id}` and `PATCH /v1/projects/{id}` (name only — a project's slug is its directory name on every host that holds it).
- f099524: `TOKEN_002` and `TOKEN_005` report the offending scopes in `detail` and as `ungrantableScopes` / `missingScopes`, instead of interpolating them into the catalog message.
- f099524: Entry points load the root `.env` through `@oppenheimer/env/load`; the TypeORM CLI previously loaded no env file at all.
- bbacd49: Build the runner ↔ control-plane link so a session can be created and run from the console.

  - API: `relay/` mounts the two sockets of the protocol on the API's own HTTP server — the runner link (`GET /api/v1/relay/runner`, boot assertion as bearer, hello/welcome, heartbeat → host presence, `events.append` → the session log, acked by key) and the browser attach socket (`GET /api/v1/relay/attach`, single-use ticket as the subprotocol, re-checked against the session and the workspace membership). `links/` holds the per-host link registry and the real `SessionDispatchPort`, replacing the pending adapter.
  - Runner: `internal/link` dials out with a per-dial EdDSA boot token, pins the control plane's key fingerprint from `welcome`, reconnects through the ladder with an epoch, streams PTY reads as attachment-id-prefixed frames and reports events with `<runId>:<n>` keys, resending what was not acked. `session.create` maps the structured launch onto the agent's argv through the catalog mirror; the sessions service gained `Stop` and a caller-provided id.
  - Web: `SessionStream` is the real transport over the attach socket, minting a fresh ticket per (re)connect; the terminal shows `offline` while the host holds no link.
  - Credentials: `credentials.token` is answered with a `credentials.grant` sealed to the host's key (Ed25519 → X25519, ephemeral ECDH, HKDF, AES-256-GCM); the runner's git credential helper pulls the token over the link, unseals it and holds it in memory until expiry or `credentials.revoke`. Hello reconciliation re-dispatches a launch the host never carried out and records stopped a session it lost. `attachment.credit` pauses PTY reads at 256 KB in flight; `host.preflight` and `host.update` are handled.
  - Shared: the protocol gains `welcome`, `session.stop`, `session.detach`, `command.failed`, `attachment.closed` and the attach socket's own vocabulary; `CacheService` gains `take()` (`GETDEL`).

- f099524: Conditional User permissions are enforced against the loaded record, and listing the global user directory requires `manage User`. A non-admin caller with only `read User` now receives 403; organization-scoped member endpoints cover tenant directories.
- 8fab63d: Add server-evaluated feature flags, wired into the API and the console.

  Flags are declared in code, targeted in the database, evaluated on the server
  and read on every client from one endpoint — the shape Stripe and Revolut
  describe for their own. Ported from the Flama starter.

  - **`@oppenheimer/shared`** gains `feature-flags/`: the `FEATURE_FLAGS` catalog
    (every flag the code may read, with its kind, owner, safe default and — for
    temporary flags — expiry), the pure evaluator (ordered rules, segments,
    semver targeting on the app build, deterministic MurmurHash3 percentage
    splits bucketed by organization), and the Zod schemas for targeting writes.
    Like `agents` and `protocol` it is reached through its own subpaths, not the
    root barrel: `@oppenheimer/shared/feature-flags`, and the Zod-free
    `@oppenheimer/shared/feature-flags/catalog` for the web bundle. A `flags`
    scope group, a `FeatureFlag` subject and a `GET /feature-flags/admin`
    endpoint policy join the catalogs.
  - **`@oppenheimer/api`** gains a `feature-flags` module. Every replica holds
    all targeting in memory and evaluates without I/O, polling a cheap
    fingerprint to stay in sync and keeping its last good snapshot through a
    database blip. `GET /v1/feature-flags` serves the caller's evaluated client
    flags (signed out too); the endpoints under `/v1/feature-flags/admin`,
    `/segments` and `/changes` edit targeting, pull kill switches, manage
    segments, explain an evaluation and read the audit trail, which every change
    lands on through the outbox. `@RequireFlag('key')` gates a route on a flag,
    and token creation is now behind the `api_token_creation` kill switch. New
    error codes `FLAG_001`–`FLAG_007`. Migration `AddFeatureFlags`, every point
    in time `timestamptz`.
  - **`@oppenheimer/api-client`**: the regenerated client carries the feature
    flag operations and DTOs.
  - **`@oppenheimer/frontend-core`**: a `feature-flags` kernel module and
    `useFeatureFlag` / `useFeatureFlagValue` / `useFeatureFlags`, typed by the
    catalog, reading the API rather than PostHog. Flags are prefetched as soon as
    the session is known, persisted with the query cache, and an `experiment`
    flag records a `feature_flag_exposed` event. `OppenheimerApp.create` takes
    `featureFlags: { platform, appVersion }`.

    **Breaking:** feature flags leave the analytics port. `IAnalyticsClient` no
    longer has `getFeatureFlags` / `onFeatureFlags`, `AnalyticsService` no longer
    serves flags, `analyticsKeys.flags` is gone, and `isFlagEnabled` moved to the
    `feature-flags` module. `useFeatureFlag(key)` keeps its name but now takes a
    catalog key and reads the server's answer.

  - **`@oppenheimer/frontend-web`**: the PostHog adapter drops its flag methods
    and switches PostHog's own flag loading off.
  - **`@oppenheimer/translations`**: messages for `FLAG_001`–`FLAG_007`, and the
    control-plane copy for a flags screen (`control.flags`, `nav.featureFlags`).
  - **`@oppenheimer/web`** reports its platform and build when it asks for its
    flags.

  `pnpm check:flags` (in CI) fails on a temporary flag past its expiry date and
  on a flag the catalog declares but no code reads.

- f101364: Sessions, their checkouts and the append-only log the session row is a fold of,
  behind eleven routes over three tables.

  `DELETE /projects/{id}` archives a project and lands here too: it asks the module
  that owns sessions whether any work is still open, through a port that module
  registers, and refuses when nothing answers. Naming a session from its first prompt
  is optional configuration — with no provider set, a session keeps its slug.

- 1ad71b4: Module layout is now a machine-checked contract: `services/` is gone, a probe is not a use case, and `pnpm check:api-structure` enforces the shape.
- f099524: Describe scope and permission-catalog responses properly in OpenAPI, so the generated client keeps their types. The wire format is unchanged.

### Patch Changes

- bb3c4e8: A runner link's event batches are recorded in the order they arrived.
- 9492e18: Point an account's org-less sessions at the personal workspace in the transaction that provisions it. Sign-up's own session was written before the workspace existed, so it carried no active organization and every org-scoped route refused the workspace's owner until they signed in again.
- f099524: Pin the controllers to `ENDPOINT_POLICIES`: a new catalog entry fails to compile until a handler is named for it.
- e717f42: Harden the runner link. PTY bytes are no longer dropped when a queue fills,
  and the runner's writer sends control frames first, then takes attachments in
  turn, so one pane's output no longer delays another pane's echo. Both sides
  now ping every 15 s, a runner the control plane cannot write to is closed
  rather than skipped, and epochs keep rising across API restarts. The
  terminal's transport (`SessionStream`, the resize coalescer, the replay
  stream) moves from `apps/web` into `@oppenheimer/frontend-consumer`, behind
  `SessionsService.openStream` and `useSessionStream`.
- f099524: Add opt-in SQL query logging (`DB_LOG_QUERIES=true`) that never logs bound parameters.
- 9604fe5: The browser attach socket keeps the frames a browser sends while its ticket is
  redeemed. The console sends its viewport the moment the socket opens; when the
  ticket lookups ran longer than that, `ws` dropped the frame with no listener,
  and the relay waited out its two-second viewport timer before attaching at
  80x24. A browser that closes during redemption no longer leaves an attachment
  open on the link.
- f099524: Take the Better Auth configuration from `@oppenheimer/auth` instead of a local copy.
- a81af0d: Every date column is stored as `timestamptz`, so dates reach clients with their offset and no longer read out by the reader's time zone.
- Updated dependencies [24d217d]
- Updated dependencies [cb56034]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [7ff8b30]
- Updated dependencies [64d3f7a]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [a880b19]
- Updated dependencies [7945f7e]
- Updated dependencies [f099524]
- Updated dependencies [79e30e5]
- Updated dependencies [79e30e5]
- Updated dependencies [83f3617]
- Updated dependencies [8e2de68]
- Updated dependencies [8e2de68]
- Updated dependencies [8e2de68]
- Updated dependencies [f099524]
- Updated dependencies [1a51afc]
- Updated dependencies [5bd4a8b]
- Updated dependencies [ed28ce2]
- Updated dependencies [f099524]
- Updated dependencies [a23b14e]
- Updated dependencies [8d78094]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [1a51afc]
- Updated dependencies [f099524]
- Updated dependencies [bbacd49]
- Updated dependencies [8e2de68]
- Updated dependencies [cb56034]
- Updated dependencies [f099524]
- Updated dependencies [8fab63d]
- Updated dependencies [bb3c4e8]
- Updated dependencies [f101364]
- Updated dependencies [f101364]
- Updated dependencies [f099524]
- Updated dependencies [a81af0d]
- Updated dependencies [1a51afc]
- Updated dependencies [1a51afc]
  - @oppenheimer/translations@0.3.0
  - @oppenheimer/shared@0.3.0
  - @oppenheimer/backend-authz@0.2.0
  - @oppenheimer/backend-llm@0.2.0
  - @oppenheimer/backend-core@0.3.0
  - @oppenheimer/backend-cache@0.2.0
  - @oppenheimer/backend-ddd@0.3.0
  - @oppenheimer/env@0.2.0
  - @oppenheimer/auth@0.2.0
  - @oppenheimer/backend-email@0.2.0
  - @oppenheimer/backend-i18n@0.1.0
  - @oppenheimer/backend-queue@0.1.1
  - @oppenheimer/backend-storage@0.1.0

## 0.2.0

### Minor Changes

- 4943eff: Add Better Auth admin (super-admin) and organization (with workspaces) plugins.

  Authentication already ran on Better Auth; this enables its official `admin` and
  `organization` plugins and wires them into the app, plus organization-scoped
  CASL authorization.

  - **`@oppenheimer/api`**: enable the `admin` plugin (super-admin: list/ban/impersonate
    users, set roles, revoke sessions — gated by the new `superadmin`/`admin`
    roles and `BETTER_AUTH_ADMIN_USER_IDS`) and the `organization` plugin
    (organizations, members, invitations, and **workspaces** via teams). New users
    get a personal organization + default workspace on sign-up; sessions carry
    `activeOrganizationId` / `activeTeamId`. Adds ORM entities + a migration for
    `organization`/`member`/`invitation`/`team`/`teamMember`, the admin columns
    (`user.banned`/`banReason`/`banExpires`, `session.impersonatedBy`), and a
    seeded `superadmin` system role. `PoliciesGuard`/`AbilityFactory` now thread
    `session.activeOrganizationId` into CASL so permissions can be org-scoped with
    `${activeOrganizationId}` conditions. System roles that grant `manage all` are
    protected from being stripped of it (admin-lockout guard).

  - **`@oppenheimer/shared`**: new `superadmin` system role and `ORGANIZATION_ROLES`;
    new Zod schemas/types for organization, member, invitation, workspace, and
    admin operations; `activeOrganizationId` / `activeTeamId` added to the CASL
    ability context; new `Organization`/`Workspace`/`Member`/`Invitation`/
    `AuditLog` known subjects. Removes the vestigial `JwtPayload`, `TokenPair`,
    `AuthProvider` types and the unused `AUTH` token-expiry constants.

  - **`@oppenheimer/backend-email`**: new `EmailService.sendInvitation` + invitation
    React Email template, sent asynchronously through the email queue.

  After deploying, run the migration (`pnpm --filter @oppenheimer/api migration:run`).
  The organization/admin operations are exposed to the frontend through the Better
  Auth `organizationClient()` / `adminClient()` plugins (already wired into the web
  and mobile auth clients), not the generated api-client.

- e209380: Add a CLI and an MCP server, both governed by granular per-credential
  permissions.

  Authorization gains a second layer. Roles say what a _person_ may do; **scopes**
  say what a _credential_ may do on their behalf, and the two are intersected on
  every request. A token can never be minted with more reach than its creator
  has, and revoking someone's role immediately narrows every credential they
  issued.

  - **`@oppenheimer/shared`**: the scope catalog — nine permission groups
    (profile, users, admin, roles, organizations, members, invitations,
    workspaces, tokens), each with a Read and an Edit level backed by the CASL
    rules it authorizes. Helpers for parsing, the write ⇒ read implication, the
    OAuth string form, and `grantableScopes`/`ungrantableScopes`, which enforce
    the "never exceed your creator" rule. Plus `ResourceScope` for per-organization
    narrowing, Zod schemas for token creation, and an `ApiToken` subject with
    own-token permissions on the seeded `user` role.

  - **`@oppenheimer/api`**: a new `api-tokens` DDD module (Better Auth 1.6 no longer
    ships an apiKey plugin). Only a SHA-256 digest of each secret is stored;
    tokens support expiry, IP allowlists and organization scoping, and are revoked
    rather than deleted. `ApiAuthGuard` replaces Better Auth's cookie-only guard
    and accepts a session cookie, an API token or an OAuth access token;
    `ScopesGuard` is registered globally and fails closed, so a route that
    declares no `@RequireScopes` cannot be reached by a token at all. The MCP
    plugin adds OAuth 2.1 discovery, dynamic client registration and a consent
    page. New endpoints: `GET|POST /v1/tokens`, `DELETE /v1/tokens/:id`,
    `GET /v1/tokens/permissions` and `GET /v1/me/credential`.

  - **`@oppenheimer/mcp`** (new): an MCP server exposing 26 tools over stdio and
    Streamable HTTP from one registry. Tools declare the scopes they need and the
    tool list is filtered by the credential's effective scopes, so an agent is
    never shown a capability that would be refused.

  - **`@oppenheimer/cli`** (new): `oppenheimer` — login that trades a session for a scoped
    token, token management with a permission catalog, users/roles/orgs/workspaces
    commands, `--json` output, profiles, and `oppenheimer mcp install` to connect an
    agent.

  Deploying runs a migration that adds the `api_token` and OAuth tables and grants
  every user permission over their own tokens. `pnpm generate:api-client` no
  longer needs a running database.

- aa0eefd: Refactor the API toward Domain-Driven Hexagon architecture.

  - Add `@oppenheimer/backend-ddd`, a building-blocks package with `Entity`,
    `AggregateRoot`, `ValueObject`, `DomainEvent`, `CommandBase`, `QueryBase`,
    the `RepositoryPort`/`Paginated` abstractions, a domain/persistence/response
    `Mapper` interface, domain exceptions and `Guard`.
  - Restructure the users module into vertical slices (`commands/`, `queries/`,
    `domain/`, `database/`, `dtos/`, `application/`) on top of `@nestjs/cqrs`,
    with a `UserEntity` aggregate, an `Email` value object, a
    `UserRepositoryPort` and its TypeORM adapter, and domain-event publishing.
  - Invert the `@oppenheimer/backend-ddd` ↔ `@oppenheimer/backend-core` layering: the
    framework-free `RequestContextService` and the `ErrorDefinition` contract now
    live in `@oppenheimer/backend-ddd` (re-exported from `@oppenheimer/backend-core` for
    backwards compatibility), so the domain layer depends on no infrastructure.
  - Document the architecture in `apps/api/ARCHITECTURE.md`, add a
    `/scaffold-module` skill, and enforce the layer boundaries with
    dependency-cruiser (`pnpm arch`, wired into CI and a Stop hook).

- 55e1d1a: Add database-backed, admin-managed roles (dynamic RBAC).

  Roles and their permissions now live in the database instead of a hardcoded
  `defineAbilitiesFor(role)` switch, and admins can manage them through the API.

  - **`@oppenheimer/shared`**: `Actions`/`Subjects` are now free-form strings; new
    `PermissionDefinition` type (with `conditions` for resource scoping, `fields`,
    `inverted`); new `defineAbilitiesFromPermissions(permissions, { user })` that
    builds a CASL ability from a flat permission list and interpolates
    `${user.id}`-style condition placeholders; new role Zod schemas
    (`createRoleSchema`, `updateRoleSchema`, `updateRolePermissionsSchema`,
    `assignUserRolesSchema`, `permissionSchema`); `SYSTEM_ROLE_PERMISSIONS` and
    `SYSTEM_ROLES`. `Role` is now `string` (roles are dynamic).

  - **`@oppenheimer/api`**: new `roles` Domain-Driven Hexagon module with a `RoleEntity`
    aggregate owning `Permission` value objects (stored as `jsonb`) and a
    `user_role` join enabling **multiple roles per user**. Endpoints (admin-only):
    `POST/GET/PATCH/DELETE /roles`, `PUT /roles/:id/permissions` (granular
    permission editing), and `GET/PUT /users/:userId/roles`. The `PoliciesGuard`
    now resolves a user's effective ability from the union of their assigned
    roles' permissions via a new `AbilityFactory` (falling back to the legacy
    `user.role` column). Adds a migration that creates the `role`/`user_role`
    tables, seeds the `admin`/`user` system roles, and backfills existing users;
    new sign-ups are assigned the default `user` role.

  After deploying, run `pnpm generate:api-client` against a running API to
  regenerate the typed client with the new `/roles` endpoints.

- 9c3e158: Add first-class REST modules for organizations, members, invitations, workspaces
  and admin (super-admin) — delegating façades over the Better Auth plugins.

  These expose the Better Auth organization/admin plugin operations as typed,
  Swagger-documented, CASL-guarded NestJS endpoints so they appear in the generated
  `@oppenheimer/api-client` (the plugins' own `/api/auth/*` endpoints are not NestJS
  controllers and never did). The controllers/services delegate to `auth.api.*`
  (via `auth/better-auth.util.ts`) rather than writing the Better-Auth-owned tables,
  so Better Auth remains the single source of truth — no domain duplication.

  - **`@oppenheimer/api`**: new `organizations` module — `OrganizationsController`
    (`/v1/organizations`: create/update/delete/set-active/list/get-full/check-slug),
    `MembersController` (`/v1/organizations/:orgId/members`: list/add/remove/
    update-role/active/leave), invitation controllers (`/v1/organizations/:orgId/
invitations` + self-service `/v1/invitations/:id/accept|reject|cancel`, list),
    and `WorkspacesController` (`/v1/workspaces`: create/update/remove/set-active/
    list/mine/members/add-member/remove-member). New `admin` module —
    `/v1/admin/users` (list/get/create/update/set-role/ban/unban/impersonate/
    stop-impersonating/remove/sessions/revoke/set-password), gated by `manage User`;
    impersonation forwards Better Auth's `Set-Cookie`.

  - **`@oppenheimer/shared`**: added request schemas/types for the above (check-slug,
    add-member, update-member-role, add-workspace-member, and body-only admin
    variants: create/update user, set-role, ban, set-password).

  Run `pnpm generate:api-client` against a running API to regenerate the typed
  client with the new endpoints.

- 719859f: Add a Stripe billing module for subscriptions and revenue.

  - **`@oppenheimer/shared`**: billing Zod schemas and types (`createCheckoutSchema`,
    `createPortalSchema`, subscription + revenue-metrics response schemas,
    `SubscriptionStatus`, `BillingInterval`), and a `Billing` known subject.
  - **`apps/api`**: a new `billing` Domain-Driven Hexagon module with a
    `Subscription` and `BillingCustomer` aggregate, a Stripe `PaymentGatewayPort`
    - adapter, and endpoints:
    * `POST /v1/billing/checkout` — start a Stripe Checkout session
    * `POST /v1/billing/portal` — open the Stripe Customer Portal
    * `POST /v1/billing/webhook` — signature-verified subscription sync
    * `GET /v1/billing/subscription` — the caller's current subscription
    * `GET /v1/billing/subscriptions` — admin, paginated (RBAC `read Billing`)
    * `GET /v1/billing/metrics` — admin revenue metrics (MRR/ARR/churn)

    Subscription state is mirrored locally from webhooks; revenue metrics are
    computed from that table (no live Stripe reads). Adds the `subscription` and
    `billing_customer` tables via migration and enables Better Auth's raw-body
    parser so Stripe webhook signatures can be verified.

### Patch Changes

- a93cf5d: Refresh dependencies and pin the versions that must move together.

  Every package is updated within its semver range, plus a set of majors that
  carry no API change for this codebase: `@sentry/nestjs` 10, `pino-http` 11,
  `@bull-board/*` 8, `nodemailer` 9, `resend` 6, `inversify` 8,
  `dependency-cruiser` 18, `testcontainers` 12 and `@commitlint/*` 21.

  Three pins are added to `pnpm.overrides`, each for a resolution that the
  update would otherwise get wrong:

  - `react-native` — the mobile design system declares it as an unbounded
    `>=0.81.0` peer with no devDependency, so it re-resolved to 0.86 while both
    Expo apps pin 0.81.5. Two copies of React Native meant two incompatible
    copies of its types, and `@oppenheimer/design-system-mobile` stopped building.
  - `@nestjs/swagger` — 11.4.3 added an `exports` map that no longer exposes
    `dist/services/schema-object-factory`, which `nestjs-zod@4` deep-imports.
    Nothing catches this at build or test time; the API simply fails to boot.
    11.4.2 is the ceiling until the `zod` 4 / `nestjs-zod` 5 migration lands.

  Two unrelated robustness fixes in the auth layer, both found while verifying
  the upgrade against a live stack:

  - The standalone BullMQ email queue had no `error` listener. A queue is an
    EventEmitter, so a Redis restart or failover would raise an unhandled
    `error` event and take the API process down.
  - The `welcome` email enqueue in Better Auth's `user.create.after` hook was
    the only unguarded operation in a hook the surrounding code documents as
    best-effort. Better Auth does not await that hook, so a queue failure
    escaped as an unhandled rejection instead of being logged.

- a2998c6: Harden the Stripe billing webhook and gateway error handling.

  - **Out-of-order deliveries**: Stripe does not guarantee webhook ordering, so a
    late `subscription.updated` arriving after `subscription.deleted` could
    resurrect stale state. `SubscriptionEntity` now records the `created`
    timestamp of the last event it applied (`lastEventAt`) and discards anything
    older. Same-second events are still applied — Stripe's `created` has second
    resolution and re-applying identical data is idempotent.
  - **Concurrent duplicate deliveries**: the check-then-insert in the webhook
    handler is not transactional, so two simultaneous deliveries could race
    between the lookup and the insert and surface an unmapped 500. A unique
    violation is now caught and reconciled against the row that won the race.
  - **`sync()` returns whether it applied**, so the handler only persists (and
    only bumps `updatedAt`) when something actually changed.
  - Gateway errors from Stripe are mapped to structured billing errors instead of
    leaking driver-level failures.

  Adds an `AddSubscriptionLastEventAt` migration for the new column.

- Updated dependencies [4943eff]
- Updated dependencies [e209380]
- Updated dependencies [aa0eefd]
- Updated dependencies [a93cf5d]
- Updated dependencies [55e1d1a]
- Updated dependencies [9c3e158]
- Updated dependencies [719859f]
  - @oppenheimer/shared@0.2.0
  - @oppenheimer/backend-email@0.2.0
  - @oppenheimer/backend-ddd@0.2.0
  - @oppenheimer/backend-core@0.2.0
  - @oppenheimer/backend-queue@0.1.1
