# @oppenheimer/shared

## 0.3.0

### Minor Changes

- 27af598: The agent catalog gains an `update` argv (the CLI's unattended updater), and the
  runner keeps installed agent CLIs current with it (`runner agents update` by
  hand). Claude Code and OpenCode seed Claude Sonnet 5.5 (`claude-sonnet-5-5`) in
  place of Sonnet 5.
- cb56034: Seed each coding agent's model list with the models its CLI documents, keyed by
  the model's full name rather than by an alias that moves under a versioned
  label: Claude Fable 5.1, Claude Opus 5, Claude Sonnet 5 and Claude Haiku 4.5 for
  Claude Code, GPT-6 Astra and GPT-5.6 Sol / Terra / Luna for Codex, which had no
  list at all. Codex's effort map reaches `xhigh`, so the slider's top two stops
  are distinct.
- f099524: Carry the resource and permission vocabulary the authorization kernel builds abilities from.
- 604707a: Automations: the API gains the `automations` and `inbound-events` modules, shared gains the trigger catalog and schemas, and the client is regenerated.
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

- f099524: Export `DEPLOYMENT_CAPABILITIES` / `DeploymentCapabilities` and the `CLIENT_CAPABILITIES` wire subset.
- a880b19: Connecting a host is hardened. An unpaired host is refused a link and stops dialling. The pairing-token cap holds under concurrent mints, and `POST /v1/hosts/pairing` takes `replaces` to retire the token on screen in the same write. The owner is emailed when a machine pairs. The agent prompt is a short template around the install command. `runner uninstall --force` keeps the pairing when a session cannot be ended, and a re-run of the installer restarts the systemd unit on the new release.
- 7945f7e: New importable surfaces for the control plane: `@oppenheimer/shared/scopes` gains the `hosts`, `projects`, `sessions` and `repositories` resources; `@oppenheimer/shared/schemas` gains host, project, session and GitHub installation DTOs plus the primitives they share; `@oppenheimer/shared/agents` is the closed coding-agent catalog; `@oppenheimer/shared/protocol` is the runner link's wire vocabulary, with its JSON Schema emitted at build.
- 09cea4c: Effort is each CLI's own levels, per model, instead of five product stops.

  - `@oppenheimer/shared`: each model lists its effort levels and default, each agent spells a level once, and `effortLevelFor` decides what may be recorded.
  - `@oppenheimer/runner`: launch effort is keyed by model and dropped when the model lacks it or the saved launch predates levels.
  - `@oppenheimer/api` / `@oppenheimer/api-client`: sessions, their log and automation revisions record only a level their model offers.
  - `@oppenheimer/web` / `@oppenheimer/translations`: the slider draws the model's levels and sends nothing until moved.
  - `@oppenheimer/design-system-web`: `EffortSlider` and `EffortPicker` take their stops from the caller; `EFFORT_STOPS` is gone.

- f099524: `ENDPOINT_POLICIES` moves to `@oppenheimer/shared/permissions`, and `./navigation` is gone.
- 79e30e5: Add `github_app` to `DEPLOYMENT_CAPABILITIES` and to the `CLIENT_CAPABILITIES` wire subset, so a console can tell "you have not connected GitHub yet" from "this deployment has no GitHub App, and Connect will refuse". It is on when all six `GITHUB_APP_*` settings are present, the App slug included, because that slug is what the install link is built from.
- 83f3617: Add Grok to the coding-agent catalog.
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

- 88f7898: Generate the runner's link protocol from the shared schema instead of keeping a hand-written Go twin. Wire-neutral: the same bytes on the wire before and after.

  - Shared: `RUNNER_LINK_REFUSAL_HEADER`, `RUNNER_LINK_REFUSALS`, `LINK_FRAME_HEADER_BYTES` and `ATTACHMENT_CREDIT_WINDOW_BYTES` join the close codes in `protocol/link.ts`, and the schema artifact carries every link constant under `x-constants`. The build also writes `protocol-schema/samples.json` (one message of every type, from the build-only `src/protocol/samples.ts`) and, through the new `scripts/emit-link-protocol.cjs`, `apps/runner/internal/link/protocol.gen.go`. Requiring an emitter no longer rewrites its output, so the committed-file specs can fail; `check:generated` runs every emitter's `--check`.
  - Runner: `link/protocol.go` keeps only what is not wire shape; the structs, the type names and the constants are generated. `link/protocol_test.go` decodes every TypeScript sample with `DisallowUnknownFields`, holds each struct and the host's `Facts`/`Tool` to the schema, and checks the constants and gofmt. The lifecycle commands decode into their own messages rather than one merged struct. The package now declares `@oppenheimer/shared`, so a shared-only change runs the Go job.
  - API: the refusal header, the `host-unpaired` refusal and the frame header width come from `@oppenheimer/shared/protocol`.

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

- ed28ce2: `createSessionSchema` takes at most one checkout (`MAX_SESSION_CHECKOUTS`): a session is one repository in the MVP.
- e505b9e: A host gets the repository ready while New session is still being written:
  picking a host and a repository sends `repository.prepare`
  (`POST /v1/sessions/prepare`), and the host clones or fetches it and builds a
  spare worktree, so the create that follows starts in about a second. A first
  clone is shallow and deepened in the background, checkouts write from one
  worker per core, and session branches are cut `--no-track`.
- 0918701: The profile schemas: a username (normalised, one pattern), changing the email and deleting the account.
- 173bb4c: Projects are a saved scope a person creates, and metadata only. `POST /projects` takes a name, the repositories (replaced as a set on `PATCH`, each with a base branch and a default flag) and a default host and agent; the slug comes from the name and never changes. Nothing is derived from a repository any more: `originGithubRepoId` is gone, and a session that names no project is listed in the workspace's **Unassigned** project, which every workspace has and which cannot be renamed or archived (`PROJECTS_008`). `POST /sessions/{id}/move` lists a session under any active project without anything moving on the host: the layout has no project level and a session's branch is `oppenheimer/<session>`. `session.create` no longer carries `projectSlug`. `GET /sessions` gains `githubRepoId`, `agent` and `sort`. The console's New project is a page (`/projects/new`) that returns to New session on the project it made; the project chip starts on Unassigned, and each sidebar row gains a Move to project menu. The translations gain a `projects` namespace. `PROJECTS_004` and `SESSIONS_009` are no longer raised.
- 9ffae03: BullMQ jobs no longer stay in Redis for ever: every queue removes completed jobs after an hour (at most 1,000) and failed ones after a week, and the durable queues keep their 24-hour window. Emails are retried five times with exponential backoff instead of failing on the first provider error. Each queue is registered once, in the API's `QueueModule`, so every producer gets the same options. The unused `file-processing` queue (`QUEUE_NAMES.FILE_PROCESSING`) and the unused `QueueModule` export of `@oppenheimer/backend-queue` are removed; the package now exports `setupBullBoard` only.
- f099524: Add the `ProblemDetails` wire type, replacing the unused `ApiErrorResponse`.
- f099524: The auth schemas no longer hardcode English failure messages, and a new `./schemas/auth` export ships them on their own.
- bbacd49: Build the runner ↔ control-plane link so a session can be created and run from the console.

  - API: `relay/` mounts the two sockets of the protocol on the API's own HTTP server — the runner link (`GET /api/v1/relay/runner`, boot assertion as bearer, hello/welcome, heartbeat → host presence, `events.append` → the session log, acked by key) and the browser attach socket (`GET /api/v1/relay/attach`, single-use ticket as the subprotocol, re-checked against the session and the workspace membership). `links/` holds the per-host link registry and the real `SessionDispatchPort`, replacing the pending adapter.
  - Runner: `internal/link` dials out with a per-dial EdDSA boot token, pins the control plane's key fingerprint from `welcome`, reconnects through the ladder with an epoch, streams PTY reads as attachment-id-prefixed frames and reports events with `<runId>:<n>` keys, resending what was not acked. `session.create` maps the structured launch onto the agent's argv through the catalog mirror; the sessions service gained `Stop` and a caller-provided id.
  - Web: `SessionStream` is the real transport over the attach socket, minting a fresh ticket per (re)connect; the terminal shows `offline` while the host holds no link.
  - Credentials: `credentials.token` is answered with a `credentials.grant` sealed to the host's key (Ed25519 → X25519, ephemeral ECDH, HKDF, AES-256-GCM); the runner's git credential helper pulls the token over the link, unseals it and holds it in memory until expiry or `credentials.revoke`. Hello reconciliation re-dispatches a launch the host never carried out and records stopped a session it lost. `attachment.credit` pauses PTY reads at 256 KB in flight; `host.preflight` and `host.update` are handled.
  - Shared: the protocol gains `welcome`, `session.stop`, `session.detach`, `command.failed`, `attachment.closed` and the attach socket's own vocabulary; `CacheService` gains `take()` (`GETDEL`).

- f099524: `canAccess()` performs the instance-level check against a loaded record, rather than answering from the grant alone.
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

- 064c443: `POST /sessions` takes exactly one checkout. A session with none was accepted,
  then refused by the runner at launch, which makes a session as one worktree of
  one repository; it is now refused with a 400 before a row is written.
  `CreateSessionInput.checkouts` is a one-element tuple to match.
- bb3c4e8: `@oppenheimer/shared/protocol` gains the `session.step` and `session.failed` payload schemas; the build generates the runner's Go twin.
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

- f101364: The query and body schemas the session routes validate against, and the
  `session_namer` capability.

  `ENDPOINT_POLICIES` is now keyed by **method and route**, so closing a session and
  reading one are two entries instead of one ambiguous path.

- 097956a: `@oppenheimer/shared` ships an ESM build in `dist/esm/` for the `import`
  condition beside the CommonJS one, declares its side effects (the two protocol
  modules that register JSON-Schema ids), and collapses its export map to four
  patterns that keep every existing specifier resolving. The web bundle now
  tree-shakes it: the first load drops from 429.3 KB to 376.2 KB gzipped, and
  `apps/web` no longer carries the `optimizeDeps.include` list or the
  `commonjsOptions` override that the CommonJS-only build needed.

### Patch Changes

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

- 8e2de68: Add the `hosts` deployment capability.
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

- a23b14e: Declare the `/projects` endpoints in `ENDPOINT_POLICIES`, so a client gates the destination on the same rule the route checks.
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

- b6676f8: The ESM build now loads in plain Node. Every relative import in `src/` is fully
  specified (`'./link.js'`, `'./constants/index.js'`), so `import('@oppenheimer/shared')`
  and its subpaths no longer fail with `ERR_UNSUPPORTED_DIR_IMPORT` outside a
  bundler, and the build's last step imports every ESM entry in Node to keep it
  that way.

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
