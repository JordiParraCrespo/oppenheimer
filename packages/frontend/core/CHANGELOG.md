# @oppenheimer/frontend-core

## 0.3.0

### Minor Changes

- f099524: Add a pluggable `analytics` module with feature flags: an adapter implements `getFeatureFlags()`, and `NoopAnalyticsClient` stands in whenever no provider is configured.
- f099524: Add `useDeploymentCapabilities()`, so a consumer renders only the social providers a deployment has configured.
- f099524: Add `createErrorMessageResolver`, which translates a failure from its problem `code`.
- e717f42: Harden the runner link. PTY bytes are no longer dropped when a queue fills,
  and the runner's writer sends control frames first, then takes attachments in
  turn, so one pane's output no longer delays another pane's echo. Both sides
  now ping every 15 s, a runner the control plane cannot write to is closed
  rather than skipped, and epochs keep rising across API restarts. The
  terminal's transport (`SessionStream`, the resize coalescer, the replay
  stream) moves from `apps/web` into `@oppenheimer/frontend-consumer`, behind
  `SessionsService.openStream` and `useSessionStream`.
- 1a51afc: Add `ConfigManager` under `@oppenheimer/frontend-core/config`.
- f099524: Add a shared TanStack Query cache-persistence policy, and reconcile a restored cache against the signed-in user so it cannot outlive its session on a shared browser or device.
- bfa1020: Breaking: `profileQueryKey` is no longer exported from `@oppenheimer/frontend-core/react`; use `usersKeys.me()`. The capabilities query is keyed `['capabilities', 'deployment']` (was `['capabilities']`), and the persist revision is bumped to drop the old entry. `usersKeys.detail` takes `string | undefined` and `useUser` fetches with `skipToken` when there is no id. New `withCacheOnSuccess(options, update)`; every mutation hook uses it, so a caller's `onSuccess` no longer replaces the hook's cache update (logout clears the cache again). `useUpdateUser` invalidates `lists()` and `me()` instead of `all`; `useDeleteUser` removes the deleted `detail(id)`.
- f099524: Expose `toAppError` and the `@MapApiError` decorator, so screens can show the server's `detail` and per-field errors.
- f099524: Add a `/validation` entrypoint exporting `createZodErrorMap`, which resolves a Zod issue to a `validation.*` translation key.
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

- f099524: `UsersRepository.findAll` / `UsersService.findAll` widen their `role` filter to `Role`, matching the database-backed roles the API accepts.

### Patch Changes

- 669b0d3: Narrow the caller's effective permissions instead of casting them: `GET /users/me/permissions` serves free-form CASL rules, and the repository now keeps the ones that carry an `action` and a `subject`.
- Updated dependencies [cb56034]
- Updated dependencies [f099524]
- Updated dependencies [64d3f7a]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [669b0d3]
- Updated dependencies [a880b19]
- Updated dependencies [9ed9703]
- Updated dependencies [7945f7e]
- Updated dependencies [f099524]
- Updated dependencies [79e30e5]
- Updated dependencies [79e30e5]
- Updated dependencies [83f3617]
- Updated dependencies [8e2de68]
- Updated dependencies [8e2de68]
- Updated dependencies [1a51afc]
- Updated dependencies [5bd4a8b]
- Updated dependencies [ed28ce2]
- Updated dependencies [2701a0c]
- Updated dependencies [a23b14e]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [bbacd49]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [8fab63d]
- Updated dependencies [bb3c4e8]
- Updated dependencies [f101364]
- Updated dependencies [f101364]
- Updated dependencies [f099524]
- Updated dependencies [1a51afc]
  - @oppenheimer/shared@0.3.0
  - @oppenheimer/api-client@0.3.0

## 0.2.0

### Minor Changes

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

- 68348a6: Surface session-restore failures instead of silently logging the user out.

  Previously a transient network/server error during startup session restore was
  indistinguishable from being genuinely unauthenticated: `getSession()` swallowed
  the error as `null`, `useSessionRestore` ran with `retry: false` and no error
  handling, and both the web and mobile `AuthGate`s only branched on `isLoading` —
  so a single network blip bounced a logged-in user to `/login`.

  - **`@oppenheimer/frontend-core`**: `useSessionRestore` now retries transient failures
    (`retry: 2` with exponential backoff). A genuinely unauthenticated user still
    resolves successfully, so retries only fire on real errors.
  - **web/mobile auth clients**: `getSession()` now throws on transport/server
    errors instead of returning `null`, letting the query distinguish a failed
    lookup from an unauthenticated session.
  - **web/mobile `AuthGate`**: render a "connection problem" screen with a retry
    action on restore failure instead of falling through to `/login`.
  - **`@oppenheimer/translations`**: new `auth.session` strings (en + es).

- Updated dependencies [4943eff]
- Updated dependencies [e209380]
- Updated dependencies [55e1d1a]
- Updated dependencies [9c3e158]
- Updated dependencies [719859f]
  - @oppenheimer/shared@0.2.0
  - @oppenheimer/api-client@0.2.0
