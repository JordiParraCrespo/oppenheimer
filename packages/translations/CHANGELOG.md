# @oppenheimer/translations

## 0.3.0

### Minor Changes

- 24d217d: Add host is a dialog in the console.

  - `@oppenheimer/web`: New session's host chip opens the Add host dialog instead
    of navigating to `/onboarding/host`; the dialog owns the Command / Agent
    prompt switch, the panel and a footer that arms on a registered host.
  - `@oppenheimer/frontend-web`: new `hosts` concern with `HostPairingChrome` —
    the token line and the status row the onboarding step and the dialog both
    draw.
  - `@oppenheimer/frontend-consumer`: `useHostPairing` (in `react/hosts.pairing.ts`)
    is the pairing flow both surfaces run; it counts `secondsLeft` rather than
    formatting a clock. `useCurrentPairing`, `usePairingTokens` and `useHosts`'s
    poll are its internals and leave the barrel; the unused `usePairHost` is gone.
  - `@oppenheimer/translations`: new `hosts` namespace for the pairing copy both
    surfaces read, `sessions.new.addHost.*` for the dialog's own words, and
    `common.close`.

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

- f099524: Add an `errors` namespace with a message per error code in both locales.
- 1a51afc: Split the catalogs into namespaced translation files.
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

- f099524: Add the `validation.*` messages the shared error map resolves (`required`, `email`, `minLength`, `maxLength`, `minItems`, `maxItems`) plus `apiTokens.permissionsRequired`, in both locales.
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

- f101364: English and Spanish messages for the `SESSIONS_*` catalog and for the three
  `PROJECTS_*` codes archiving adds.
- 1a51afc: Add `/locales` and `/lazy` entrypoints so only the default locale reaches the critical path, and declare `sideEffects`.

### Patch Changes

- f099524: Add the strings the login page renders when a deployment has no social provider configured.
- 79e30e5: Add `errors.byCode` messages for the ten `GITHUB_*` codes in both locales.
- 8e2de68: Add the `HOSTS_*` error messages in `en` and `es`.
- 8d78094: Translate the `PROJECTS_*` problem codes in every locale.
- 1a51afc: Add an `errors.byCode` message for `ROLE_007` (`SYSTEM_ROLE_MISSING`) in both locales.
- bbacd49: Build the runner ↔ control-plane link so a session can be created and run from the console.

  - API: `relay/` mounts the two sockets of the protocol on the API's own HTTP server — the runner link (`GET /api/v1/relay/runner`, boot assertion as bearer, hello/welcome, heartbeat → host presence, `events.append` → the session log, acked by key) and the browser attach socket (`GET /api/v1/relay/attach`, single-use ticket as the subprotocol, re-checked against the session and the workspace membership). `links/` holds the per-host link registry and the real `SessionDispatchPort`, replacing the pending adapter.
  - Runner: `internal/link` dials out with a per-dial EdDSA boot token, pins the control plane's key fingerprint from `welcome`, reconnects through the ladder with an epoch, streams PTY reads as attachment-id-prefixed frames and reports events with `<runId>:<n>` keys, resending what was not acked. `session.create` maps the structured launch onto the agent's argv through the catalog mirror; the sessions service gained `Stop` and a caller-provided id.
  - Web: `SessionStream` is the real transport over the attach socket, minting a fresh ticket per (re)connect; the terminal shows `offline` while the host holds no link.
  - Credentials: `credentials.token` is answered with a `credentials.grant` sealed to the host's key (Ed25519 → X25519, ephemeral ECDH, HKDF, AES-256-GCM); the runner's git credential helper pulls the token over the link, unseals it and holds it in memory until expiry or `credentials.revoke`. Hello reconciliation re-dispatches a launch the host never carried out and records stopped a session it lost. `attachment.credit` pauses PTY reads at 256 KB in flight; `host.preflight` and `host.update` are handled.
  - Shared: the protocol gains `welcome`, `session.stop`, `session.detach`, `command.failed`, `attachment.closed` and the attach socket's own vocabulary; `CacheService` gains `take()` (`GETDEL`).

- cb56034: Add `sessions.new.{host,repository,branch}.loading` in both locales — what a
  scope chip's popup says while its list is still being read, in place of
  "No host matches."

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

  - copy for the token-creation and OAuth consent screens.

  Deploying runs a migration that adds the `api_token` and OAuth tables and grants
  every user permission over their own tokens. `pnpm generate:api-client` no
  longer needs a running database.

### Patch Changes

- 68348a6: Surface session-restore failures instead of silently logging the user out.

  Previously a transient network/server error during startup session restore was
  indistinguishable from being genuinely unauthenticated: `getSession()` swallowed
  the error as `null`, `useSessionRestore` ran with `retry: false` and no error
  handling, and both the web and mobile `AuthGate`s only branched on `isLoading` —
  so a single network blip bounced a logged-in user to `/login`.

  - **web/mobile auth clients**: `getSession()` now throws on transport/server
    errors instead of returning `null`, letting the query distinguish a failed
    lookup from an unauthenticated session.
  - **web/mobile `AuthGate`**: render a "connection problem" screen with a retry
    action on restore failure instead of falling through to `/login`.
  - **`@oppenheimer/translations`**: new `auth.session` strings (en + es).
