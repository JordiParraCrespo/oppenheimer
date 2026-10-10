# @oppenheimer/api

## 0.3.0

### Minor Changes

- 951a622: `GET /v1/access-grants` is paginated, and the scope resolver's grant lookup is
  one statement shape.

  - **Breaking response shape:** `GET /v1/access-grants` returned every grant in
    the organization as a bare array. It now takes `page` and `limit` (default
    20, at most 100) and answers `{ data, meta }` like the other paginated lists
    (`PaginatedAccessGrantsResponseDto`), newest first. No first-party client
    called it; an API-token script reading the array needs to read `data` and
    follow `meta.totalPages`.
  - `findActiveForPrincipals` passes the principals as two arrays through
    `unnest`, so the SQL text no longer changes with how many teams and roles a
    user has (one plan-cache and `pg_stat_statements` entry), and it still reads
    through `IDX_access_grant_lookup`.

- ed28ce2: A runner's refusal of a session command is recorded on the session's log, so a start the host refuses fails instead of staying `starting`; adding a second repository to a session is `SESSIONS_010`.
- bea0846: Retention periods, the pairing token's lifetime and per-user cap, and the
  default and auth-failure rate limits are read from config, each overridable by
  an env var documented in `.env.example`. Defaults are unchanged.
- 51c52fd: Credential kinds are now contributed to the auth kernel with `AuthModule.contributeCredentials`, so `auth` no longer imports the modules built on it.
- f099524: Adopt the authorization kernel. A route that declares no policy no longer admits any authenticated caller, and two tenants can both define a `manager` role.
- 604707a: Automations: the API gains the `automations` and `inbound-events` modules, shared gains the trigger catalog and schemas, and the client is regenerated.
- 7ff8b30: `@oppenheimer/backend-llm`: one `complete()` client over several LLM providers;
  the API binds it from `LLM_*`.

  Sessions are named from their first prompt: a model with a short deadline,
  otherwise the prompt's own words. `SESSION_NAMER_PROVIDER`,
  `SESSION_NAMER_BASE_URL`, `SESSION_NAMER_API_KEY` and `ANTHROPIC_API_KEY` are gone.

- 4337279: Backlog gauges: `queue_jobs{queue,state}` for every BullMQ queue,
  `outbox_messages{status}` (pending, failed) and
  `outbox_oldest_pending_age_seconds`, sampled every `METRICS_SAMPLE_INTERVAL_MS`
  (15 s) while `METRICS_TOKEN` is set, with `backlog_sample_success` and
  `backlog_sample_timestamp_seconds` per source so a failed or stale sample shows.
  The three outbox gauges come from one `OutboxService.backlog()` statement, so
  they always describe the same moment; the new partial index
  `IDX_outbox_message_failed` (migration `AddOutboxFailedIndex`) keeps its failed
  count off a table scan. The next sample is scheduled only once the last one
  settles, so a slow dependency spaces samples out instead of stacking them, and
  every queue is resolved at boot, so a missing one fails the boot by name.
- 64d3f7a: Remove the Stripe `billing` module and the `leads` example the project
  inherited from the Flama starter. Neither was ever composed into the API, so no
  endpoint a deployment served goes away; what goes is everything that existed
  only for them. Stripe billing can be brought back from the Flama starter's
  `billing` plugin, then `pnpm generate:api-client`.

  These are breaking changes for anything that imported the removed names, which
  is why the packages below take a minor bump while they are on 0.x.

  - `@oppenheimer/api` drops `src/billing`, `src/leads`, the `stripe` config and
    the `stripe` dependency, and the `stripe_billing` capability (and with it the
    property on `GET /health/capabilities`). The `lead`, `subscription` and
    `billing_customer` tables, which nothing ever wrote, are gone from the
    schema. The `STRIPE_*`
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
- 09cea4c: Effort is each CLI's own levels, per model, instead of five product stops.

  - `@oppenheimer/shared`: each model lists its effort levels and default, each agent spells a level once, and `effortLevelFor` decides what may be recorded.
  - `@oppenheimer/runner`: launch effort is keyed by model and dropped when the model lacks it or the saved launch predates levels.
  - `@oppenheimer/api` / `@oppenheimer/api-client`: sessions, their log and automation revisions record only a level their model offers.
  - `@oppenheimer/web` / `@oppenheimer/translations`: the slider draws the model's levels and sends nothing until moved.
  - `@oppenheimer/design-system-web`: `EffortSlider` and `EffortPicker` take their stops from the caller; `EFFORT_STOPS` is gone.

- 79e30e5: Add the `github/` module: connect and disconnect a GitHub App installation, list what it covers live from GitHub, and mint a one-hour token narrowed to one repository. One table, `github_installation`, and no repository table — the installation is the allowlist and GitHub enforces it. `POST /installations` proves the caller can see the installation it claims by exchanging the OAuth code from the same redirect. The six `GITHUB_APP_*` settings are optional and surface as the `github_app` capability.
- bedf387: Foreign keys and indexes for Better Auth's `session` (`impersonatedBy`, `activeOrganizationId`, `activeTeamId`), a unique provider-account key on `account`, indexes on `verification` and the missing foreign-key indexes on `invitation`, and readable names for the auth tables' constraints.
- cdc6219: The probes say less and decide more strictly.

  - `GET /api/v1/health` checks nothing but that the process answers, and always
    serves `{ "status": "ok" }`. The 200 MB heap check is gone: it restarted a
    busy process at its peak.
  - `GET /api/v1/ready` checks PostgreSQL (`SELECT 1` on the app's own pool) and
    Redis (`PING`) concurrently, each within its own deadline
    (`HEALTH_DATABASE_TIMEOUT_MS`, `HEALTH_REDIS_TIMEOUT_MS`), counts
    only an explicit "up" as up, and answers
    `{ status, checks: { database, redis } }` with one word for a failure; the
    reason is logged. The heap and disk thresholds are no longer part of it.
  - **Response shape:** both bodies replace Terminus' `info`/`error`/`details`.
    Nothing in the repository read them.
  - `@nestjs/terminus` is no longer a dependency: nothing uses it.

- c078d0d: `GET /health/capabilities` reports `hosts`, and the console's pairing surfaces mint no token when it is false.
- 8e2de68: Add `hosts/`: pairing tokens, host registration, and the host's boot assertion
  as the `host` credential kind this module contributes to the auth kernel with
  `AuthModule.contributeCredentials`.
- fc0e75d: The hosts backend for the Settings page (`product/versions/mvp/14-hosts-settings.md`).

  - `@oppenheimer/api`: a host read carries a derived `status` (`running`, `idle`,
    `offline`, `unpaired`) and `runningSessionCount`, counted by `sessions/`
    through `HostsModule.contributeUsage`. `GET /v1/hosts` leaves unpaired hosts
    out unless `include=unpaired`. Removing a host, from either end, stops the
    sessions running on it. New `GET /v1/hosts/pairing/{id}` returns the token and
    the host it paired, for Add host's "Listening for this host…".
  - `@oppenheimer/shared`: `HOST_STATUSES`, `listHostsQuerySchema`, and an
    optional `cpus` on the host facts, on both Zod entry points.
  - `@oppenheimer/api-client`: regenerated; `getPairingToken`,
    `PairingTokenStatusResponseDto`, `HostStatus`.
  - `@oppenheimer/runner`: the facts report the logical CPU count as `cpus`.
  - `@oppenheimer/api`: host metadata tables (`host_inventory`, `host_presence`,
    `host_network`, `host_event`), backfilled from `host`; the old columns stay
    until the code switches over (`product/versions/mvp/15-host-metadata.md`).
  - `@oppenheimer/api`: heartbeats write `host_presence` and, only when the
    machine changed, `host_inventory`, with the change on the host's timeline;
    host responses carry `machine`, `vitals` and `network`;
    `GET /v1/hosts/{id}/timeline`. The network a runner connects from is
    recorded and placed with DB-IP Lite (`HOSTS_GEOIP_CITY_DB`,
    `HOSTS_GEOIP_ASN_DB`, the `ip_geolocation` capability); a move to another
    country or network operator emails the owner. A daily job purges networks
    unseen for 90 days and timeline entries past 180.
  - `@oppenheimer/runner`: reports OS name, kernel, CPU model, memory, disk
    total, virtualization, cloud, time zone, boot time and service manager,
    and available memory on the heartbeat.
  - `@oppenheimer/backend-email`: `sendHostNetworkChanged` and its template.
  - `@oppenheimer/translations`: `emails.hostNetworkChanged`.

- 2202daa: A session's first task can carry images.

  - `@oppenheimer/shared`: `session.create` carries `images` for runners that name `session.create.images`; `POST /sessions` takes `attachmentIds`.
  - `@oppenheimer/api`: `POST /v1/sessions/attachments` stages an image for the create that names it.
  - `@oppenheimer/runner`: pulls a create's images and names their paths to the agent with the task.
  - `@oppenheimer/frontend-consumer`: `useUploadSessionAttachment`.
  - `@oppenheimer/web`, `@oppenheimer/translations`: the paperclip and paste attach images to the first task.

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
- 2dc27d2: Plan: a task board, goals and a calendar, the console rail's third item
  (`product/versions/mvp/17-plan.md`).

  - `@oppenheimer/api`: the `tasks` module (tasks, goals, the board's order,
    starting or linking a session, the attach rule) and the `calendar` module
    (personal events, read-only Google Calendar through a port, the sealed
    refresh token under `CALENDAR_TOKEN_KEY`), with the `google_calendar`
    capability, two migrations and the `Task` and `Calendar` rules on `owner`.
  - `@oppenheimer/web`: `/plan` (the board and its dialogs), `/plan/calendar`
    (the month and its layers) and `/plan/calendar/google` (Google's return),
    the Plan rail item, and "Back to task" in a session's status bar.
  - `@oppenheimer/frontend-consumer`: the `tasks` and `calendar` modules and
    their query hooks; `toCreateSessionRequest` is shared by both start paths.
  - `@oppenheimer/frontend-web`: `DateField`, `TimeField` and calendar-day
    helpers in the `i18n` concern.
  - `@oppenheimer/api-client`: regenerated for the new routes.
  - `@oppenheimer/shared`: the task, goal and calendar schemas, the `tasks` and
    `calendar` scopes and the `Task` and `Calendar` subjects.
  - `@oppenheimer/translations`: the `tasks` and `calendar` namespaces,
    `nav.plan`, the date and time field copy and the new toasts.

- e505b9e: A host gets the repository ready while New session is still being written:
  picking a host and a repository sends `repository.prepare`
  (`POST /v1/sessions/prepare`), and the host clones or fetches it and builds a
  spare worktree, so the create that follows starts in about a second. A first
  clone is shallow and deepened in the background, checkouts write from one
  worker per core, and session branches are cut `--no-track`.
- 0918701: A username on the account, `POST /profile/email` and `DELETE /profile`; a password change keeps the device signed in.
- 8d78094: Add the `projects/` module: `GET /v1/projects`, `GET /v1/projects/{id}` and `PATCH /v1/projects/{id}` (name only — a project's slug is its directory name on every host that holds it).
- 173bb4c: Projects are a saved scope a person creates, and metadata only. `POST /projects` takes a name, the repositories (replaced as a set on `PATCH`, each with a base branch and a default flag) and a default host and agent; the slug comes from the name and never changes. Nothing is derived from a repository any more: `originGithubRepoId` is gone, and a session that names no project is listed in the workspace's **Unassigned** project, which every workspace has and which cannot be renamed or archived (`PROJECTS_008`). `POST /sessions/{id}/move` lists a session under any active project without anything moving on the host: the layout has no project level and a session's branch is `oppenheimer/<session>`. `session.create` no longer carries `projectSlug`. `GET /sessions` gains `githubRepoId`, `agent` and `sort`. The console's New project is a page (`/projects/new`) that returns to New session on the project it made; the project chip starts on Unassigned, and each sidebar row gains a Move to project menu. The translations gain a `projects` namespace. `PROJECTS_004` and `SESSIONS_009` are no longer raised.
- fe25a5e: Prometheus metrics.

  - `@oppenheimer/backend-core` gains `MetricsModule.forRoot` (the application's
    own registry, with process metrics), `createMetricsProvider` /
    `InjectMetric` for a module's own counters, gauges and histograms, and
    `HttpMetricsModule.register`: `http_requests_total{route,status_class}` and
    `http_request_duration_seconds{route}`, labelled by route group through a
    policy the application owns (at most 100 rules and 20 groups), every series
    created at zero, aborted connections counted apart and never timed. Built on
    `@prometheus-io/client`, the maintained successor of `prom-client`.
  - The API serves the registry at `GET /api/v1/metrics` when `METRICS_TOKEN` is
    set, to HTTP Basic auth with the token as password, and answers 404
    otherwise. The endpoint is not in the OpenAPI document.

- cefbc53: Pull requests: a queue of the watched repositories' open pull requests read live from GitHub (Mine, Review requests, Watching), each in a rule-based lane with what holds it; a briefing with the path to merge, the description, the diff with line comments, and a review that approves and merges in the user's own name; watched repositories; and analytics of the review period against the one before.
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

- b2fd6a1: A session takes files, not only images: PNG, JPEG, GIF and WebP as before,
  plus PDF and UTF-8 text (plain, Markdown, CSV, JSON, code, logs), pasted,
  dropped or attached to the first task. Every file is judged by its bytes at
  the API and again on the host: executables, archives, scripts with a `#!`
  line, SVG and HTML are refused whatever they are called, and the runner
  names each file itself. A runner announces the wider set with the
  `session.files` capability; an older one is still sent images only.
- 3404cd3: A session's terminal can be shared with a link, to watch or to type, for anyone, any signed-in account or named people (`product/versions/mvp/21-session-share-links.md`).
- ca05d90: Cheaper runner-link traffic and a keyset session list.

  - `@oppenheimer/api`: a batch of session events lands in one `INSERT` (the
    `MAX(seq)` read still runs after the row lock, in its own statement), and the
    runner's append no longer reads the session before its transaction
    (`appendEventsForHost`). A link's queued `events.append` batches for one
    session are coalesced into one append and acknowledged per `batchId`. The
    queue is bounded: the socket is paused at 64 waiting batches, resumed at 16,
    and closed with 1013 at 256 or after a 10 s pause; the keepalive does not
    terminate a link it paused. Runner frames are capped at 512 KiB by `ws`
    itself (1009). A heartbeat is one statement when the inventory is unchanged:
    `recordVitalsIfPaired` replaces `recordVitals` and the host-row read.
    `GET /v1/sessions` takes an opaque `cursor` and answers `meta.nextCursor`;
    page mode is unchanged apart from `recent`'s id tie-break now running
    descending.
  - `@oppenheimer/shared`: `listSessionsQuerySchema` takes an optional `cursor`.
  - `@oppenheimer/api-client`: regenerated — `cursor` on `listSessions`,
    `nextCursor` on `SessionPageMetaDto`, whose counts are now optional.
  - `@oppenheimer/frontend-consumer`: `SessionsRepository.findAll` walks the list
    by cursor instead of by page and count.

- f101364: Sessions, their checkouts and the append-only log the session row is a fold of,
  behind eleven routes over three tables.

  `DELETE /projects/{id}` archives a project and lands here too: it asks the module
  that owns sessions whether any work is still open, through a port that module
  registers, and refuses when nothing answers. Naming a session from its first prompt
  is optional configuration — with no provider set, a session keeps its slug.

- 1ad71b4: Module layout is now a machine-checked contract: `services/` is gone, a probe is not a use case, and `pnpm check:api-structure` enforces the shape.
- f099524: Describe scope and permission-catalog responses properly in OpenAPI, so the generated client keeps their types. The wire format is unchanged.
- 818f20c: `GITHUB_015` and `CALENDAR_010` are 429s with `Retry-After`, declared on every route that reaches GitHub or Google. `@oppenheimer/backend-core` gains `UpstreamLimiter` and `AppError.retryAfterSeconds`; `@oppenheimer/backend-cache` gains `CacheService.setMax`.

### Patch Changes

- 9e28367: The relay no longer crashes on a malformed frame or a reset connection: the browser attach socket listens for errors from the moment it is upgraded, a ticket lookup that fails closes the socket with 1011 instead of leaking an unhandled rejection, and every upgrade socket has an error listener while a gateway awaits.
- 369c7f8: Authorization stops re-reading roles on every request.

  - `@oppenheimer/api`: a user's role-derived permissions are cached in Redis,
    keyed on three version counters read in one query per request — the
    organization's `roleVersion`, the new `role_catalog_version` (global roles)
    and `user_role_version` (a user's global assignments), added by migration
    `AddAuthzVersions`. Every role and assignment write bumps the counter that
    covers it in its own transaction, so a revocation is visible on the next
    request on every replica. Platform roles resolve from an in-process snapshot
    of the global roles; the access-scope interceptor reuses the role ids the
    ability was built from and reads team membership in one join. A warm
    guarded, scoped request makes 3 authorization queries instead of 6. Redis
    failing falls back to the database.
  - `@oppenheimer/backend-core`: `requestMemo(request, key, compute)`, one
    in-flight computation per key per request, evicted on rejection.
  - `@oppenheimer/backend-authz`: `ResolveScopeInput.roleIds`, optional, for a
    caller that already knows the roles.

- 80d97c0: Automations: the hourly rate caps hold under concurrency, and the runs list reads only its window.

  - The one-minute schedule tick runs every statement on its own transaction's
    connection. It reads the workspaces' limits and the last hour's counts once,
    inside the claim, and counts the runs it queues as it goes, so a batch cannot
    fire past a cap. It claims triggers `FOR NO KEY UPDATE SKIP LOCKED`.
  - Event firing and the tick take a per-workspace advisory lock around count and
    insert (`fireUnderCaps`), so concurrent events, or events and a tick, cannot
    all take the last slot. An event reads the workspace's settings once.
  - The runs list scopes on `automation_run."organizationId"` beside the window,
    so the scan starts at the window, and it reads its counts in one grouped
    statement instead of two. The response is unchanged.
  - The run-limit sweep skips runs live past the platform ceiling plus an hour,
    so they can no longer take every slot, and it reads each automation and owner
    once per tick.
  - Archiving a project finds its automations by workspace and project.

- 1c9d474: Banned and deactivated accounts are refused on every credential.

  - One rule, `isAccessAllowed` (`auth/domain/account-access.policy.ts`): an
    account may act unless it is deactivated or under a ban that has not expired.
  - API tokens and OAuth (MCP) access tokens of a banned owner now get
    `TOKEN_003`; before, only `isActive` was checked.
  - A browser session (cookie, or session token as bearer) of a deactivated or
    banned account now gets `AUTH_001`, with the same detail as no session;
    `OptionalApiAuthGuard` routes treat the caller as anonymous.
  - Deactivating an account through `UpdateUserCommand` raises
    `UserDeactivatedDomainEvent`; its handler deletes the account's Better Auth
    sessions and rotates its delegated-session generation.
  - `AdminService.ban` and `.unban` rotate the delegated-session generation, so
    façade calls through a credential work again straight after an unban.

- 4420967: Bound both Postgres pools. TypeORM's and Better Auth's pools are sized by
  `DB_POOL_MAX` (10) and `DB_AUTH_POOL_MAX` (5), fail a query that waits longer
  than `DB_CONNECTION_TIMEOUT_MS` (5 s) for a free connection, and send
  `statement_timeout` (`DB_STATEMENT_TIMEOUT_MS`, 15 s), `lock_timeout`
  (`DB_LOCK_TIMEOUT_MS`, 5 s) and `idle_in_transaction_session_timeout`
  (`DB_IDLE_IN_TRANSACTION_TIMEOUT_MS`, 30 s) to Postgres, with
  `application_name` `api` and `api-auth`. Boot migrations run first on a
  single connection of their own (`api-migrations`) without those timeouts.
- 5a49133: - A membership whose application role cannot be written is undone rather than
  left on the roster: adding a member, changing a member's role and accepting
  an invitation now roll the Better Auth write back, as creating an
  organization already did. Accepting an invitation whose system role is
  missing answers `ROLE_007` instead of a bare 500.
  - Removing a member or leaving takes their roles, access grants and session
    selection in one transaction.
  - `GET /v1/organizations/{orgId}/members` filters in the database, and is no
    longer capped by Better Auth's page size.
  - `POST /v1/organizations/check-slug` answers `available: false` only for a
    taken slug; any other refusal is the problem document it is.
  - `POST /v1/admin/users/{id}/sessions/revoke` finds the session by id, and the
    admin session list reads every row rather than the first 1,000.
  - An organization created from the console raises `OrganizationCreatedDomainEvent`
    rather than sign-up's `PersonalWorkspaceProvisionedDomainEvent`.
  - Operation ids of admin, organization, invitation and workspace routes the
    console does not call now name their use case (`add` → `addMember`,
    `ban` → `banUser`, …).
- 91b98ed: Two fixes in the API. The active API token limit is now enforced atomically, so
  concurrent requests can no longer create tokens past it. An allowlist entry
  written as an IPv4-mapped IPv6 prefix, such as `::ffff:203.0.113.0/120`, now
  matches the IPv4 clients it names. Feature flag writes can no longer race one
  another or a segment delete, and a failed audit write or flag reload for a flag
  change is retried instead of being dropped.
- 323ae84: Security hardening follow-ups.

  - `POST /v1/sessions/{id}/attach-ticket` and `POST /v1/sessions/{id}/restart`
    answer `404 HOSTS_001` when the caller can no longer use the session's host
    (a revoked grant, an unpaired host). Redeeming a ticket checks it too, and
    an open attachment is judged again every minute (session state, workspace
    membership, account standing, host access) and closed with the matching
    reason and code when refused; a check that throws keeps the socket.
  - A GitHub webhook body replayed under a new `X-GitHub-Delivery` is the
    delivery already stored: `inbound_delivery.payloadDigest` (SHA-256 of the
    raw bytes) is unique per source. Events older than the delivery retention
    window are dropped when a delivery is processed.
  - `installation` suspend/unsuspend webhooks apply in the order of GitHub's own
    timestamp (`github_installation.statusChangedAt`), so a late retry cannot
    undo a newer change; `suspendedAt` holds GitHub's time.
  - `inbound_delivery.eventCount` is the total of the delivery's events, so a
    re-run no longer resets it to 0.
  - The automation prompt's untrusted-data envelope escapes its attributes and
    carries `<`, `>` and `&` in the JSON as `\u` escapes, so the event's text
    can never close it.
  - Bull Board stays off with a password shorter than 16 characters, with a
    warning at boot.
  - A banned or deactivated owner's host is refused at the runner link
    handshake and its open link is closed by a heartbeat within a minute; a session's
    git token is not minted for a creator who may not act.
  - A ban or unban made straight through Better Auth
    (`/api/auth/admin/ban-user`, `/unban-user`) rotates the account's
    delegated-session generation, as `AdminService` already did.

- 141d0ec: Index the automation and session hot paths and drop two unused indexes.

  - New: `IDX_automation_run_dispatched` (partial, the live-run checks on every
    tick and dispatch), `IDX_automation_run_created_brin` (the nightly run purge),
    `IDX_work_session_event_first_prompt` (partial, the first prompt on a runner's
    hello), and `IDX_work_session_created_by` / `IDX_session_checkout_installation`
    behind two foreign keys that had none.
  - `IDX_automation_trigger_automation` is rebuilt with `automationId` first.
  - Dropped: `IDX_session_checkout_session` and `IDX_work_session_organization_state`.

- a0e23bd: Operations are named by one factory and a collision fails generation; nullable enums list `null` (`nullableEnum`).
- bb3c4e8: A runner link's event batches are recorded in the order they arrived.
- 2063d42: A rate-limited request answers `RATE_001` with a `retryAfter` member instead of a codeless 429. `POST /v1/access-grants` returns the grant it created, instead of falling back to another grant in the organization.
- 97791d0: Index the admin user search and the four foreign keys that had no index.

  - The `pg_trgm` extension and `IDX_user_search_trgm`, a GIN over `user` `firstName`,
    `lastName` and `email`, so a search of three or more characters no longer
    scans the table.
  - New `IDX_github_installation_installed_by`, `IDX_host_pairing_token_redeemed_host`
    (partial), `IDX_user_role_organization` (partial) and `IDX_user_role_role`.

- fb396c1: Better Auth sessions are cached in Redis, and each credential is resolved once
  per request.

  - `secondaryStorage` over the shared `REDIS_CLIENT`, keyed `ba:<sha256>` so no
    session token is a key name; sessions are still written to (and revoked
    from) the `session` table, which answers whenever Redis misses or is down.
    A cookie request no longer reads the `session` table; a bearer session token
    costs one OAuth lookup instead of three queries.
  - Every session row Better Auth deletes drops its cached copy first, and a
    revocation that cannot reach Redis fails instead of half-succeeding.
  - New `SESSION_CACHE` port: deactivation, profile and avatar edits, a removed
    member, the provisioned personal workspace and account deletion refresh or
    drop the cached copies in the same request. "Sign out other devices" also
    sweeps sessions Better Auth's cache index never knew.
  - The rate limiter keys a bearer by a digest of the secret and a browser by its
    signed session cookie, with no database or Better Auth call; refused
    credentials count against their IP (30 a minute, then `RATE_001`).
  - Delegated sessions for scoped credentials are minted only on routes marked
    `@UsesBetterAuthSession()`, and read in one Redis round trip.
  - An API token's `lastUsedAt` is written at most once a minute, by a guarded
    update that leaves `updatedAt` alone.

- d1a5af2: Internal cleanup with no change on the wire: the OpenAPI document and every
  problem document stay the same.

  - Session commands and queries load their session through
    `SessionLoaderResolver` (`find`, and `requireLive` for the commands that
    refuse a resolved session); closing a resolved session is still a no-op.
  - Automation handlers use `requireFound` for their not-found check.
  - The users and roles list queries use `@oppenheimer/shared`'s
    `paginationSchema`, and the four list endpoints build `meta` with
    `toPageMeta` and their response DTOs with `PaginatedResponseDto`.

- ff6d0c6: An automation run reserves its slot, so the overlap and capacity guards
  actually cap.

  `liveRunsPerHost` and the overlap policy were weighed against counts read a
  moment before the run launched, and the runs processor dispatches four at once:
  every worker read the same counts, every worker passed. Measured on a real
  stack — ten manual runs of an automation whose overlap is `skip`, which means
  one live run — **four** sessions started, one per worker. The same burst now
  starts one.

  The reservation is a new `automation_run."claimedAt"`, written under a per-host
  advisory lock against counts read inside it, and counted by both guards while
  it is fresh. It is deliberately not another `outcome`: the run stays `pending`
  while it holds a slot, so the state machine every client reads is unchanged and
  "dispatched implies a session" keeps holding — a first version of this fix
  marked the run dispatched early and broke exactly that, which the API's own e2e
  caught. A claim is honoured only while fresh, so a process dying between the
  claim and the session frees the slot with nothing to clean up.

- 9492e18: Point an account's org-less sessions at the personal workspace in the transaction that provisions it. Sign-up's own session was written before the workspace existed, so it carried no active organization and every org-scoped route refused the workspace's owner until they signed in again.
- 3de723c: Open the request's correlation id in middleware, so a guard's refusal carries it.

  - Removed: `RequestContextInterceptor`. Guards run before interceptors, so a
    401, 403 or 429 a guard threw went out with no `correlationId`.
  - Added: `RequestContextMiddleware`, which the API applies to every route in
    `AppModule.configure`, and `resolveCorrelationId` / `isValidCorrelationId` /
    `CORRELATION_HEADER`. An inbound `x-correlation-id` is honoured only when it
    is 1–64 characters of `[A-Za-z0-9._:-]` (the first value of a repeated
    header); anything else becomes a fresh UUID.
  - `buildPinoHttpOptions` sets `genReqId`, so the request log's `req.id` is the
    correlation id (no longer pino's counter), and every response, including the
    Better Auth routes, echoes it as `x-correlation-id`.

- 1094480: Creating a role no longer falls back to a global role for any caller when the
  request has no organization. `POST /v1/roles` without an active organization
  still creates a global role for a platform admin (`manage all`), and answers
  `ROLE_008` (400) for anyone else instead of writing a role every tenant reads.
  The command must set `CreateRoleCommand.global` explicitly, and the handler
  checks `manage all` again before creating the role. Adds the `ROLE_008`
  message in both locales.
- 5a88302: Slim `RepositoryPort`, share the non-tenant TypeORM write path, and move
  "wake after commit" into `OutboxService.transaction`.

  - `@oppenheimer/backend-ddd`: `RepositoryPort` declares only `insert`, `save`,
    `findOneById` and `delete`. `findAll`, `findAllPaginated` and `transaction`
    are gone: nothing called `transaction`, and every implementation dropped the
    `EntityManager`, so writes made inside it never joined the transaction. A
    port that needs a list declares it. New `OutboxService.transaction(work)`
    runs `work` in one transaction and wakes the relay after commit when
    `stageEvents` (with at least one event) or `stageJob` ran on its manager;
    never after a rollback, never when nothing was staged. `writeWithEvents` is
    built on it. New `TypeOrmRepositoryBase<Aggregate, Orm>`: the port's four
    methods for a non-tenant adapter (map, write through `writeWithEvents`, map
    back), with `idColumn` for a table keyed by something other than `id`.
  - `@oppenheimer/api`: the user, feature-flag, flag-segment and user-settings
    adapters extend `TypeOrmRepositoryBase`; roles and API tokens lose their dead
    `findAll` / `findAllPaginated` / `transaction`. Every repository that staged
    outbox rows in its own transaction (projects, inbound events, automations,
    automation runs, hosts, host metadata, sessions, the personal workspace) now
    opens it with `outbox.transaction` and keeps no `staged` flag or `wake()`
    call of its own.

- f099524: Pin the controllers to `ENDPOINT_POLICIES`: a new catalog entry fails to compile until a handler is named for it.
- 7ed4e17: The GitHub App install callback is bound to the person who started it.

  - `@oppenheimer/api`: `POST /v1/installations/install-state` (`startInstallation`)
    mints a single-use, 15-minute state bound to the caller and the workspace and
    answers the App's install URL carrying it. `POST /v1/installations` requires
    that state and spends it before GitHub is called; anything else is
    `GITHUB_011`, one code for missing, expired, reused and someone else's.
  - `@oppenheimer/shared`: `connectInstallationSchema` requires `state`
    (`installStateSchema`).
  - `@oppenheimer/api-client`: regenerated.
  - `@oppenheimer/frontend-consumer`: `useStartInstallation`, and
    `InstallationsService.connect` takes `{ githubInstallationId, code, state }`.
  - `@oppenheimer/web`: Connect GitHub and New session's Manage repository access
    mint the state on click; a callback without one is refused on screen and
    never posted. The first-run walk rides as the state's prefix.
  - `@oppenheimer/translations`: `errors.byCode.GITHUB_011`,
    `onboarding.flow.github.unstarted`, `onboarding.flow.github.starting`,
    `sessions.new.repository.manageFailed`.

- bec9d40: A host boot assertion used in the five and a half minutes before the deploy that
  moved cache keys under `cache:` can no longer be replayed once after it. The
  replay guard also honours the unprefixed marker a replica wrote before the
  prefix (`LegacyReplayMarkerPort`, one `EXISTS`). The check is for one release:
  every such marker has expired by the next one, and it is marked for removal then.
- 88f7898: Generate the runner's link protocol from the shared schema instead of keeping a hand-written Go twin. Wire-neutral: the same bytes on the wire before and after.

  - Shared: `RUNNER_LINK_REFUSAL_HEADER`, `RUNNER_LINK_REFUSALS`, `LINK_FRAME_HEADER_BYTES` and `ATTACHMENT_CREDIT_WINDOW_BYTES` join the close codes in `protocol/link.ts`, and the schema artifact carries every link constant under `x-constants`. The build also writes `protocol-schema/samples.json` (one message of every type, from the build-only `src/protocol/samples.ts`) and, through the new `scripts/emit-link-protocol.cjs`, `apps/runner/internal/link/protocol.gen.go`. Requiring an emitter no longer rewrites its output, so the committed-file specs can fail; `check:generated` runs every emitter's `--check`.
  - Runner: `link/protocol.go` keeps only what is not wire shape; the structs, the type names and the constants are generated. `link/protocol_test.go` decodes every TypeScript sample with `DisallowUnknownFields`, holds each struct and the host's `Facts`/`Tool` to the schema, and checks the constants and gofmt. The lifecycle commands decode into their own messages rather than one merged struct. The package now declares `@oppenheimer/shared`, so a shared-only change runs the Go job.
  - API: the refusal header, the `host-unpaired` refusal and the frame header width come from `@oppenheimer/shared/protocol`.

- e717f42: Harden the runner link. PTY bytes are no longer dropped when a queue fills,
  and the runner's writer sends control frames first, then takes attachments in
  turn, so one pane's output no longer delays another pane's echo. Both sides
  now ping every 15 s, a runner the control plane cannot write to is closed
  rather than skipped, and epochs keep rising across API restarts. The
  terminal's transport (`SessionStream`, the resize coalescer, the replay
  stream) moves from `apps/web` into `@oppenheimer/frontend-consumer`, behind
  `SessionsService.openStream` and `useSessionStream`.
- 2f7fdce: `LlmError` gains the `rate_limited` code and `resetAt`; `@oppenheimer/backend-email` gains `EmailRateLimitedError`. The email worker holds its queue until a provider's reset.
- f099524: Add opt-in SQL query logging (`DB_LOG_QUERIES=true`) that never logs bound parameters.
- a7aa829: `GET /v1/organizations/:orgId/members/me` answers for the organization in the path (`getMembership({ path: { orgId } })`); the unused legacy `OrganizationMembersApi` class is removed.
- a44d660: Every job staged on the outbox carries the correlation id of what owed it,
  passed explicitly: an inbound delivery's processing job takes the receiving
  command's, an automation run's dispatch the firing command's (an event-fired
  run inherits the webhook's id through the event's metadata), and the sweeps
  that re-stage lost jobs record none.
- 249b51b: The outbox relay renews its lease while it delivers a batch. A listener slower
  than the lease (30 s by default) could be claimed and run a second time by
  another replica's poll; now a heartbeat (`OutboxService.extendLease`, every
  third of the lease) keeps the rows, fenced on the relay's owner. The marks that
  end a delivery are fenced too: `markProcessed(ids, owner)` only marks rows that
  owner still leases, and `markFailed` only touches the claim it came from, so a
  relay that lost its lease anyway never finishes or releases another relay's
  claim. `OutboxRelayOptions.heartbeatMs` sets the renewal interval.

  Removed the unused `PaginatedQueryParams` and `OrderBy` types from the package's
  exports; nothing in the workspace read them since list queries moved onto the
  ports that need them.

- 1c2ae71: The outbox no longer puts delivery on the request path, and no longer grows
  for ever.

  - `OutboxService.wake()` returns `void` and does not wait for the drain it
    asks for. Before, `await wake()` resolved only after every drain queued
    ahead of it and a drain of every due row, listeners included, had finished,
    so a webhook accept or a runner `events.append` waited on the global
    backlog. Call it without `await`; an `await` on it still compiles and does
    nothing. Nothing tells a caller when its listeners have run.
  - `OutboxRelay.requestDrain()` runs at most one drain at a time; requests
    that land during it collapse into one more pass, instead of an unbounded
    chain of passes. `drainOnce()` still waits for the drain.
  - The relay marks a batch processed in one statement. A process that dies
    between publishing and that statement redelivers up to `batchSize` rows,
    which at-least-once delivery already allowed.
  - New `OutboxService.deleteProcessedBefore(cutoff, batch)`: the batched
    retention delete of `processed` rows. The API runs it daily
    (`QUEUE_NAMES.OUTBOX_RETENTION`, 7 days); `pending` and `failed` rows are
    kept.
  - `OutboxMessageSchema` declares `IDX_outbox_message_pending` (partial,
    `("createdAt") WHERE status = 'pending'`) and `IDX_outbox_message_created_brin`
    in place of `IDX_outbox_message_status_available`, mirroring the API's
    schema.

- 69b8209: Organization-scoped routes authorize in the organization they name, other routes in the session's organization; a malformed organization id is `AUTHZ_003`, and the unused `X-Active-Organization` header (`AUTHZ_001`) is gone.
- 2d84b28: Pull requests read GitHub under its limits and survive a refused part. Each token keeps at most four requests in flight and waits out `Retry-After` and a spent budget, and a long wait is `GITHUB_015` instead of `GITHUB_009` (#247). Analytics reads at most the 150 most recently closed pull requests and says so when there were more. A pull request whose checks GitHub refuses keeps its row with "Checks unavailable", a repository GitHub will not answer is named instead of failing the queue, and a refused permission says what to grant (#244).
- c412130: The Pull requests area reads the repositories you watch, and nothing until you
  watch one. The queue answers with the rows it could fill and fills more over
  the reads that follow, rather than making you wait for every part of every row;
  a pull request it has not read yet is left out instead of shown with a lane and
  a checks state nobody read. Your own pull requests are recognised from a
  personal installation when you have no stored GitHub grant. The review
  period's numbers are kept in the browser's cache, so Analytics draws them at
  once instead of a skeleton, and a quarter's chart is drawn by the week, as the
  artboard draws it. What a read could not show is one notice rather than a
  callout per repository, part and refusal.
- 9ffae03: BullMQ jobs no longer stay in Redis for ever: every queue removes completed jobs after an hour (at most 1,000) and failed ones after a week, and the durable queues keep their 24-hour window. Emails are retried five times with exponential backoff instead of failing on the first provider error. Each queue is registered once, in the API's `QueueModule`, so every producer gets the same options. The unused `file-processing` queue (`QUEUE_NAMES.FILE_PROCESSING`) and the unused `QueueModule` export of `@oppenheimer/backend-queue` are removed; the package now exports `setupBullBoard` only.
- 942e8dc: One Redis command connection for the API. The cache, the rate limiter and the
  health probe share `REDIS_CLIENT` (`RedisModule`), which fails fast during a
  Redis outage (no offline queue, one retry, 1 s command timeout) instead of
  hanging requests, and is closed on shutdown. Every Redis client, BullMQ's and
  the standalone email queue's included, reads its address from the one `redis`
  config section (`redisConnectionOptions`). The rate limiter runs its script by
  hash (`EVALSHA`) instead of sending it on every request, and the GitHub
  repository picker shares one listing between concurrent requests.

  `@oppenheimer/backend-cache`: `CacheModule.register()` is replaced by
  `CacheModule.registerAsync({ inject, useFactory: () => ({ client, keyPrefix }) })`
  and `RedisCacheService` takes the ioredis client instead of building one; the
  package no longer owns or closes a connection. Every key is written under a
  prefix (`cache:` by default). `reset()` (`FLUSHDB` on the database BullMQ also
  uses) is removed. New: `mget` and `getOrSet`, single-flight per process.

- 9604fe5: The browser attach socket keeps the frames a browser sends while its ticket is
  redeemed. The console sends its viewport the moment the socket opens; when the
  ticket lookups ran longer than that, `ws` dropped the frame with no listener,
  and the relay waited out its two-second viewport timer before attaching at
  80x24. A browser that closes during redemption no longer leaves an attachment
  open on the link.
- 38b511f: Restart brings a session back where it left off, and the stopped pane says so.

  A restart recreated window 0 and started the agent from nothing, replaying the
  first task — so the conversation was lost and the work asked for twice. Now
  that a session names the agent's own conversation, a restart reopens it
  instead: same worktree, same branch, the whole exchange back, and no prompt
  re-sent because the conversation already holds it. Grok joins Claude Code;
  Codex and OpenCode can only resume an id they chose themselves, so they keep
  restarting the way they did.

  The pane that said "This session has stopped. Its work is on its branch" now
  names the branch, says restarting brings the terminal back where it left off,
  and leads with **Restart**. A deleted session has no worktree to return to, so
  it is offered nothing.

- dcc5fe1: Role grants respect CASL conditions, and platform roles resolve from global rows only.

  - `@oppenheimer/backend-authz`: `ungrantablePermissions` and `canGrant` take the
    context the actor's ability was built with and check that each requested
    rule is contained in one of the actor's rules, conditions included. An actor
    who holds `manage Session` only for their own organization can no longer
    write unconditioned `manage Session`, or the rule for another organization,
    onto a role or assign a role that carries it. `describePermission` shows a
    rule's conditions.
  - `@oppenheimer/shared`: new `interpolatePermissionConditions`, which resolves a
    stored rule's `${...}` placeholders the way the ability builder does.
  - `@oppenheimer/api`: role create, update, update-permissions and assignment
    reject such rules with `ROLE_005`, and the detail says whether the caller
    lacks the rule or holds it only under narrower conditions. The role
    catalog's `grantable` list uses the same check. A Better Auth platform role
    (`user.role`) is looked up among global roles only, so a tenant role of the
    same name is never used in its place.

- 5b93fd7: Runner review follow-ups. `systemctl`, `loginctl` and `launchctl` calls now time out after a minute. `runner sessions` refreshes the whole host in one pass. An event batch the link took but never acked is sent again after a minute, together with every batch made after it, in order. The link has one frame cap, `LINK_MAX_FRAME_BYTES` (512 KiB), shared by the control plane and the generated `MaxFrameBytes`: the runner reads nothing larger and never sends anything larger. When the session list in `hello` and `heartbeat` does not fit, it is sent compact, and only past about 2,800 sessions is it truncated.
- 024f31b: User and role search match `%` and `_` literally.

  - Added `likeContains(term)` to `@oppenheimer/backend-core`: an `ILIKE`
    contains-pattern with the term's `%`, `_` and `\` escaped.
  - `GET /v1/users?search=` and `GET /v1/roles?search=` use it, so `a_b` no
    longer matches `axb` and `%` no longer matches every row. `search` is trimmed
    and capped at 100 characters (documented as `maxLength` in the OpenAPI
    document; a longer term is a 400).

- 958dbed: Session cache follow-ups:

  - Signing out every device of a user holding more than a hundred sessions now
    evicts every cached copy. Better Auth hands its `session.delete.before` hook at
    most a hundred rows of a bulk delete, so the rest stayed live in Redis whenever
    its own per-user index had lost them; the hook now evicts all of the user's
    rows when they hold more than it is handed.
  - The admin session list, and revoking one of a user's sessions by id, read the
    `session` table instead of Better Auth's Redis index, so a session signed in
    before the cache existed (or whose index entry was lost) is listed and can be
    revoked.

- 8f5fd3d: A session names the agent's own conversation, so a stopped session can be
  reopened instead of read back.

  These CLIs already keep the transcript — the catalog's `transcriptLocation` is
  where — so nothing said in a session was ever lost. What was missing was a name
  both sides agree on: the CLI picked its own id and told nobody, so the only way
  back to a conversation was the tmux pane, which dies with the session. A run
  stopped by the hour limit left a console screen saying "This session has
  stopped" and nothing else, which for an automation run is the whole result.

  The launch now carries `conversation`, the session's own id, and the catalog
  says per agent how to pin it and how to reopen it — `--session-id` and
  `--resume` for Claude Code. An agent whose CLI cannot be told an id, or that
  keeps no transcript at all (the blank terminal), is sent nothing.

  Verified end to end: a session created, answered, its tmux session destroyed,
  and `--resume` in the same worktree brought back the whole conversation, live
  and ready for a follow-up.

- f099524: Take the Better Auth configuration from `@oppenheimer/auth` instead of a local copy.
- 315ed15: Squash the 51 migrations into one baseline, `InitialSchema`
  (`1790900000000-InitialSchema.ts`, its SQL split by module under
  `initial-schema/`), which produces the identical schema, and
  remove `apps/api/db/ops/` with its hand-run index scripts and rollbacks.
  Nothing had been deployed. A local database created before this change must
  be dropped and recreated: its migrations table names migrations that no longer
  exist.
- 04f899d: A stopped session stops holding its host's automation slot.

  Stopping a session ends its processes and leaves the worktree, so the lifecycle
  deliberately does not move: it stays `open` with `stoppedAt` set, and can be
  restarted. The automation guards counted it as live anyway, so every session
  ever stopped on a host consumed one of that host's slots for good. Measured:
  six stopped sessions filled a `liveRunsPerHost` of two, and every automation on
  that host deferred for ever behind panes that had not existed for hours —
  silently, because deferring is what a busy host is supposed to look like.

  The guards now read `stoppedAt`. Nothing else changes: a live session counts as
  it always did.

- 7844fd3: `StorageService.upload` resolves to the key on every back-end, and
  `getSignedUrl` is renamed `getUrl`.

  - `LocalStorageService.upload` used to resolve to a public URL while
    `S3StorageService.upload` resolved to the key, so a caller's result depended
    on configuration. Both now resolve to the key; `getUrl(key, expiresIn?)` is
    the one way to a URL (signed on S3, `<publicUrl>/uploads/<key>` locally).
  - The avatar adapter persists what `upload` returns instead of working around
    the disagreement.

- b336aae: The polls the workspace event stream covers stand down while it is live: every package poll goes through `usePollWhile(kind, queryKey, active)`, and one coverage table in `workspace-events.ts` says which keys stand down (sessions, their start steps, a pending pairing token) and which only catch up (presence, automation runs); they poll again the moment the stream drops. The API ends every stream on a replica whose Redis subscriber connection closes, so a console is never live and deaf, and the console refetches what the stream covers each time it comes up, the first connect included.
- 4308c64: The two claim-and-restage sweeps recover the rows they were written to recover.

  `AutomationRunRepository.restageStalled` and
  `InboundEventRepository.restageUnprocessed` both read an `UPDATE … RETURNING`
  as if TypeORM answered it with the rows. It answers `UPDATE` and `DELETE` with
  `[rows, affected]`, so each sweep looped over an array and a number, staged two
  jobs a tick whose `runId` / `inboundDeliveryId` was `undefined` — which the
  processor logged as "Unknown … job" and dropped — and never re-dispatched a
  run or restaged a delivery that was genuinely stuck. `restageUnprocessed` also
  reported a constant two abandoned deliveries.

  On a host left running, that was a garbage `outbox_message` row every thirty
  seconds (nearly four thousand of them here) and a matching BullMQ completed
  key, forever. The rule is now in `.agents/rules/typeorm.md`, and both sweeps
  have a regression test whose fake query answers in the driver's shape.

- a81af0d: Every date column is stored as `timestamptz`, so dates reach clients with their offset and no longer read out by the reader's time zone.
- Updated dependencies [24d217d]
- Updated dependencies [27af598]
- Updated dependencies [cb56034]
- Updated dependencies [369c7f8]
- Updated dependencies [a0e23bd]
- Updated dependencies [2063d42]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [604707a]
- Updated dependencies [99219f9]
- Updated dependencies [1ed003e]
- Updated dependencies [eeaf30a]
- Updated dependencies [65a7b1c]
- Updated dependencies [7ff8b30]
- Updated dependencies [64d3f7a]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [a880b19]
- Updated dependencies [7945f7e]
- Updated dependencies [3de723c]
- Updated dependencies [1094480]
- Updated dependencies [affe343]
- Updated dependencies [22e89e4]
- Updated dependencies [fad86a0]
- Updated dependencies [5a88302]
- Updated dependencies [09cea4c]
- Updated dependencies [be76e39]
- Updated dependencies [f099524]
- Updated dependencies [7ed4e17]
- Updated dependencies [79e30e5]
- Updated dependencies [79e30e5]
- Updated dependencies [83f3617]
- Updated dependencies [c078d0d]
- Updated dependencies [8e2de68]
- Updated dependencies [8e2de68]
- Updated dependencies [8e2de68]
- Updated dependencies [fc0e75d]
- Updated dependencies [745dcd8]
- Updated dependencies [88f7898]
- Updated dependencies [2f7fdce]
- Updated dependencies [f099524]
- Updated dependencies [1a51afc]
- Updated dependencies [2202daa]
- Updated dependencies [5bd4a8b]
- Updated dependencies [ed28ce2]
- Updated dependencies [d5d310c]
- Updated dependencies [f099524]
- Updated dependencies [249b51b]
- Updated dependencies [1c2ae71]
- Updated dependencies [c3c7883]
- Updated dependencies [2d00e7e]
- Updated dependencies [2dc27d2]
- Updated dependencies [e505b9e]
- Updated dependencies [0918701]
- Updated dependencies [0918701]
- Updated dependencies [a23b14e]
- Updated dependencies [8d78094]
- Updated dependencies [173bb4c]
- Updated dependencies [fe25a5e]
- Updated dependencies [cefbc53]
- Updated dependencies [2d84b28]
- Updated dependencies [c412130]
- Updated dependencies [d79d831]
- Updated dependencies [9ffae03]
- Updated dependencies [942e8dc]
- Updated dependencies [6b943c3]
- Updated dependencies [38b511f]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [1a51afc]
- Updated dependencies [dcc5fe1]
- Updated dependencies [f099524]
- Updated dependencies [bbacd49]
- Updated dependencies [5b93fd7]
- Updated dependencies [8e2de68]
- Updated dependencies [cb56034]
- Updated dependencies [f099524]
- Updated dependencies [024f31b]
- Updated dependencies [8fab63d]
- Updated dependencies [b2fd6a1]
- Updated dependencies [a566fac]
- Updated dependencies [064c443]
- Updated dependencies [3404cd3]
- Updated dependencies [bb3c4e8]
- Updated dependencies [ca05d90]
- Updated dependencies [f101364]
- Updated dependencies [f101364]
- Updated dependencies [8f5fd3d]
- Updated dependencies [f099524]
- Updated dependencies [097956a]
- Updated dependencies [b6676f8]
- Updated dependencies [c237a5f]
- Updated dependencies [7844fd3]
- Updated dependencies [b336aae]
- Updated dependencies [43a17c1]
- Updated dependencies [0e5fd26]
- Updated dependencies [0e25c03]
- Updated dependencies [a81af0d]
- Updated dependencies [ab97201]
- Updated dependencies [818f20c]
- Updated dependencies [e647495]
- Updated dependencies [8d66c87]
- Updated dependencies [1a51afc]
- Updated dependencies [1a51afc]
- Updated dependencies [a0e23bd]
  - @oppenheimer/translations@0.3.0
  - @oppenheimer/shared@0.3.0
  - @oppenheimer/backend-core@0.3.0
  - @oppenheimer/backend-authz@0.2.0
  - @oppenheimer/backend-llm@0.2.0
  - @oppenheimer/backend-ddd@0.3.0
  - @oppenheimer/backend-email@0.3.0
  - @oppenheimer/backend-cache@0.2.0
  - @oppenheimer/backend-i18n@0.1.1
  - @oppenheimer/backend-queue@0.2.0
  - @oppenheimer/env@0.2.0
  - @oppenheimer/auth@0.2.0
  - @oppenheimer/backend-storage@0.2.0

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
