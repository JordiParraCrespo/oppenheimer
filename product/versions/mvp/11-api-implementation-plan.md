# 11 — API: implementation plan

How [`10-api-modules-and-data-model.md`](10-api-modules-and-data-model.md)
becomes code in `apps/api`, slice by slice, against the contract the
repo enforces (`apps/api/ARCHITECTURE.md`,
`scripts/check-api-structure.mjs`, `apps/api/.dependency-cruiser.cjs`).
Every path below is a real path in the module contract; every check is
one that runs in CI today. The runner's counterpart work is listed at
the end because the last slice cannot be verified without it.

## What a slice is

One pull request, one vertical cut, shippable alone, green on:

```bash
pnpm check:api-structure                 # module contract
pnpm --filter @oppenheimer/api arch      # dependency-cruiser boundaries
pnpm --filter @oppenheimer/api lint test # biome + vitest, incl. the two sweeps:
                                         #   route-policy-coverage, error-catalog-coverage
pnpm --filter @oppenheimer/api test:integration   # testcontainers, real migration chain
pnpm generate:api-client && pnpm changeset
```

Every slice that adds a route also adds: `@Version('1')`, `@ApiTags`,
`@ApiOperation`, `@ApiResponse`, `@CheckPolicies` or `@NoPolicy('<≥15
chars>')`, `@RequireScopes`; every new error code adds its catalog
entry in `domain/<module>.errors.ts`, an `@ApiProblemResponse`, a row in
`apps/docs/docs/errors.md`, and `errors.byCode` in `en` and `es`. Every
new env var adds a commented line to the root `.env.example`, and an
optional one is surfaced through `resolveCapabilities`.

**Error-code prefixes are plural** — `HOSTS_`, `GITHUB_`, `PROJECTS_`,
`SESSIONS_`, `RELAY_` — because the Go runner already owns `HOST_00x`,
`PAIR_00x` and `SESS_00x` in the same `errors.md`, and the catalog test
fails on a reused code.

## Order and parallelism

```
0 shared ─┬─ 1 github ────┐
          ├─ 2 hosts ─────┼─ 4 sessions ─┬─ 5 console
          └─ 3 projects ──┘              └─ 6 relay ── (step-one spike gate)
runner:      R1 paths+header (with 2)        R2 link, R3 layout (with 6)
```

1, 2 and 3 do not touch each other's files and can land in any order.
4 needs all three. 5 and 6 need 4. The whole thing is six API pull
requests and three runner ones.

## Slice 0 — `packages/shared`: the vocabulary

No API code. Everything the API slices import.

- `src/scopes/catalog.ts`: `SCOPE_RESOURCES` gains `hosts`, `projects`,
  `sessions`, `repositories`, each with a `PERMISSION_GROUPS` entry
  (`read`/`write`, backing policies). `scopes.spec.ts` enforces the
  pairing, so the tuple and the groups land together.
- `src/permissions/abilities.ts`: `SYSTEM_ROLE_PERMISSIONS.owner` gains
  `manage` on `Project`, `Session` and `Installation` conditioned on
  `${activeOrganizationId}` (no `Repository`: a subject with no row is a
  fiction; listing routes sit on `read Installation`); there is no
  `member` system role in the constant, so a workspace member is
  granted nothing until the teams slice, and a spec says so;
  **`SYSTEM_ROLE_PERMISSIONS.user`**
  gains `manage Host` conditioned on `{ ownerUserId: '${user.id}' }`,
  because a host is the person's and belongs on the person's role, the
  way `ApiToken` already does. `KNOWN_SUBJECTS` gains the five.
- `src/schemas/`: `host.schema.ts` (`mintPairingTokenSchema`,
  `registerHostSchema` — matching the runner's `RegisterRequest`:
  `token, name, publicKey, facts`; `renameHostSchema`),
  `project.schema.ts` (`updateProjectSchema`), `session.schema.ts`
  (`createSessionSchema` with `checkouts: [{installationId, githubRepoId,
  baseBranch?}]`, `cwdGithubRepoId?`; `addCheckoutSchema`;
  `renameSessionSchema`), `github.schema.ts` (`connectInstallationSchema`:
  `installationId`, `code`).
- `src/agents/catalog.ts`: the closed union `claude-code | codex` with
  its config record (launch command, login-URL pattern, transcript
  location), imported by the console through a subpath and by the API.
- `src/protocol/`: **decided here, the 01 open question 1** — the wire
  vocabulary is Zod (`hello`, `heartbeat`, the link hints, the
  commands, `events.append` / `events.ack`, `attachment.credit`,
  `credentials.token` / `credentials.grant`), the source of truth this
  repo already uses for DTOs, on the **same Zod line** as the DTO
  schemas; JSON Schema is emitted by the package's `build` from a
  build-only module that is not on the runtime surface, and Go structs
  are generated into `packages/go/protocol` from that JSON Schema. One
  source, two languages, no hand-written twin. Every addition to the
  link is written into 01 in the same pull request, because 01 owns the
  wire. Slice 6 is the first consumer; the package lands here so the
  runner slices can start. **Interim, recorded on pull request #22:**
  the protocol module sits on the `zod/v4` entry point of the installed
  Zod because only that emits JSON Schema; the DTO schemas stay on
  classic Zod because `nestjs-zod` 4.3.1 rejects v4 schema objects, and
  no dependency could be added from the build environment (a mobile git
  dependency lives on a blocked host). The one duplicated schema is
  asserted identical by a spec. The follow-up is one command on a
  machine with normal egress — `pnpm add -D zod-to-json-schema --filter
  @oppenheimer/shared` — then the emitter moves to it and `zod/v4`
  leaves the package.

Done when `pnpm --filter @oppenheimer/shared test` is green and
`@RequireScopes('hosts:read')` compiles in `apps/api`.

## Slice 1 — `github/`: one table, a live listing, a token mint

```
apps/api/src/github/
  github.module.ts  github.resource.ts  github.di-tokens.ts  github-installation.mapper.ts
  domain/github-installation.entity.ts  domain/github.errors.ts
  domain/events/installation-connected.domain-event.ts
  database/github-installation.orm-entity.ts  .repository.port.ts  .repository.ts
  infrastructure/github-app.port.ts            # list repos, list branches, mint token, verify claim
  infrastructure/octokit-github-app.adapter.ts # @octokit/app + @octokit/rest, the only Octokit importer
  infrastructure/github-webhook.util.ts        # X-Hub-Signature-256 over the raw body
  application/repository-access.port.ts        # what sessions/ and relay/ inject: mintRepositoryToken(installationId, githubRepoId)
  application/repository-access.resolver.ts    # live mint every time; nothing token-shaped is cached
  commands/connect-installation/   POST /installations        (OAuth code → GET /user/installations proof; 409 GITHUB_ALREADY_CONNECTED)
  commands/disconnect-installation/ DELETE /installations/{id}
  commands/handle-github-webhook/  POST /github/webhook       (@NoPolicy, @SkipThrottle, RawBodyRequest; `installation` events only)
  queries/find-installations/      GET /installations
  queries/list-installation-repositories/  GET /installations/{id}/repositories           (GitHub, Redis 60 s)
  queries/list-repository-branches/        GET /installations/{id}/repositories/{githubRepoId}/branches   (GET /repositories/{id} then branches; never the installation's full list)
  dtos/installation.response.dto.ts  dtos/repository.response.dto.ts
  __tests__/installation-scoping.spec.ts  __tests__/github-webhook.spec.ts
```

- Migration `AddGithubInstallations`: the table with unique
  `githubInstallationId` and unique `(organizationId, id)`. Migration
  `AddInstallationRolePermissions`: the append-only jsonb edit giving
  `owner` `manage Installation` **and** `UPDATE organization SET
  roleVersion = roleVersion + 1`. **Each slice carries the role rule for
  its own subject** (Project in the projects PR, Host on the `user` role
  in the hosts PR, Session in the sessions PR), each idempotent and each
  bumping `roleVersion`, so every stacked pull request is usable on its
  own and none waits on another for a workspace owner to stop getting
  403.
- Config `github.config.ts`: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`,
  `GITHUB_APP_WEBHOOK_SECRET`, `GITHUB_APP_CLIENT_ID`,
  `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_SLUG` — all optional, all six
  one predicate, surfaced as the `github_app` capability **on the client
  subset** (the console needs "not configured" and the slug for the
  install URL); the adapter asks the capability rather than re-deriving
  it. Without them the repo chip says "connect GitHub" and nothing else
  breaks. The GitHub adapter is `fetch` plus `node:crypto` (RS256 App
  JWT), not Octokit: no dependency to add, and the App API is five
  routes.
- The raw body already reaches `request.rawBody` (Better Auth's
  `bodyParser.rawBody`), so the webhook needs no bootstrap change: copy
  `billing/commands/handle-stripe-webhook`.
- Tests: scoping spec in the `lead-scoping.spec.ts` shape; webhook
  signature accept/reject; the claim proof refuses an installation the
  caller cannot see; integration: the migration chain runs and a
  connect-then-list round trip works against a recorded Octokit fake.
  E2E `e2e/tests/api/installations.spec.ts`: 401 and 403 problem
  documents.

## Slice 2 — `hosts/`: pairing, registration, the host assertion

```
apps/api/src/hosts/
  hosts.module.ts  hosts.resource.ts (keys {owner:'ownerUserId', id}, scopes ['own','grant'], credentialScope 'hosts')
  hosts.di-tokens.ts  host.mapper.ts  host-pairing-token.mapper.ts
  domain/host.entity.ts  domain/host-pairing-token.entity.ts  domain/hosts.errors.ts
  domain/events/host-registered.domain-event.ts
  database/host.orm-entity.ts  host-pairing-token.orm-entity.ts  *.repository.port.ts  *.repository.ts
  infrastructure/runner-release.config.ts      # install command + agent prompt template, deploy-owned
  infrastructure/host-assertion.util.ts        # EdDSA verify (jose), fingerprint = sha256 hex of the raw key
  application/host-assertion.port.ts           # verifyAssertion(jwt) → { hostId }, burns jti in Redis for its lifetime
  application/host-assertion.resolver.ts
  application/host-access.port.ts              # what sessions/ injects: assertUsable(scope, hostId)
  commands/mint-pairing-token/   POST /hosts/pairing         body {name}; returns {installCommand, agentPrompt, expiresAt}
  commands/revoke-pairing-token/ DELETE /hosts/pairing/{id}
  commands/register-host/        POST /hosts/register        (@NoPolicy, @Throttle 10/min; redeem + insert one tx; fingerprint retry)
  commands/rename-host/          PATCH /hosts/{id}
  commands/unpair-host/          DELETE /hosts/{id}          (console)
  commands/uninstall-host/       DELETE /hosts/self          (@NoPolicy('the caller is a host, not a user'); HostPrincipalGuard; Authorization: Bearer <boot JWT>)
  guards/host-principal.guard.ts               # admits only a request the resolver classified as a host principal
  queries/find-hosts/            GET /hosts                  (online = lastSeenAt > now() − 30 s, in SQL)
  queries/find-host/             GET /hosts/{id}
  queries/find-pairing-tokens/   GET /hosts/pairing
  dtos/host.response.dto.ts  dtos/pairing-token.response.dto.ts
  __tests__/host-scoping.spec.ts  __tests__/host-assertion.spec.ts
```

- Migration `AddHosts`: both tables as in note 10, `host` with no
  `organizationId`.
- `POST /hosts/register` answers the runner's existing
  `RegisterResponse`: `{hostId, fingerprint, channel, releaseBaseUrl}`.
  `fingerprint` is the control plane's own Ed25519 public-key
  fingerprint, from a new `CONTROL_PLANE_SIGNING_KEY` in `.env.example`
  (required once hosts exist; the runner pins it, F6). The name is the
  token's `intendedName` when set, else the runner's `name`.
- The boot JWT is an ordinary `Authorization: Bearer`, so this slice
  also touches `apps/api/src/auth/application/credential-scope.resolver.ts`:
  a fourth credential kind, resolved by asking hosts' `HostAssertionPort`
  when the bearer parses as an EdDSA JWT with a host `sub`, yielding a
  host principal with no scopes. `ScopesGuard` lets it through with no
  `@RequireScopes` on the route, and `HostPrincipalGuard` refuses
  everyone else. The same port is what the relay gateway calls in
  slice 6. Never a private header (note 10, decided after the owner's
  review of R1).
- Tests: own/grant scoping with no tenant predicate and `1 = 0` for a
  stranger; redeem is single-use under concurrency (integration, two
  parallel redeems, one host); retry with the same key returns the same
  host; assertion replay refused by `jti`; E2E
  `e2e/tests/api/hosts.spec.ts` drives the whole pairing flow with a
  request-level fake runner (mint → register with a generated Ed25519
  key → uninstall with a signed assertion).

## Slice 3 — `projects/`: one aggregate, the slug

```
apps/api/src/projects/
  projects.module.ts  projects.resource.ts  projects.di-tokens.ts  project.mapper.ts
  domain/project.entity.ts  domain/projects.errors.ts  domain/project-slug.policy.ts  (sanitise; the three deterministic candidates)
  database/project.orm-entity.ts  *.repository.port.ts  *.repository.ts
  application/project-lookup.port.ts           # what sessions/ injects: ensureForRepository(scope, { githubRepoId, owner, name }) → projectId
  application/project-lookup.resolver.ts       # INSERT … ON CONFLICT (organizationId, originGithubRepoId) DO NOTHING RETURNING; reselect by origin; next candidate only on a foreign slug conflict
  commands/update-project/   PATCH /projects/{id}       (name only; slug immutable; targeted UPDATE, never a full-entity save)
  queries/find-projects/     GET /projects              (non-archived)
  queries/find-project/      GET /projects/{id}
  dtos/project.response.dto.ts  __tests__/project-scoping.spec.ts  __tests__/project-slug.spec.ts
```

Archive (`DELETE /projects/{id}`) is **not** in this slice: it needs
"has open sessions", which only the sessions slice can answer, and a
placeholder answering no would be fail-open on the destructive path.
Migration `AddProjects`: unique `(organizationId, slug)`, partial unique
`(organizationId, originGithubRepoId)`, organization FK `ON DELETE
RESTRICT`; the `(organizationId, id)` unique comes with the sessions
migration. `AddProjectRolePermissions`: `owner` gains `manage Project`,
`roleVersion` bumped. `operationId`s are `listProjects`, `getProject`,
`updateProject`; `ENDPOINT_POLICIES` gains the three routes; notes 03
and 11 gain the project noun in the same pull request.
The auto-create race gets an integration test with two concurrent
creates on a fresh repository.

## Slice 4 — `sessions/`: the aggregate, the log, the fold — no relay yet

```
apps/api/src/sessions/
  sessions.module.ts  sessions.resource.ts (actions read/create/update/delete; attaching is `update` behind `sessions:write`)
  sessions.di-tokens.ts  work-session.mapper.ts
  domain/work-session.entity.ts                 # recordEvent() is the only mutator; holds checkouts
  domain/session-checkout.entity.ts  domain/work-session-event.entity.ts
  domain/session-state.policy.ts                # the fold: (state, event) → state
  domain/session-group.policy.ts                # derived group; debounce from recorded transitions; precedence ≠ display
  domain/session-slug.policy.ts                 # <adjective>-<noun>-<6 base36>
  domain/sessions.errors.ts  domain/events/session-*.domain-event.ts
  database/work-session.orm-entity.ts  session-checkout.orm-entity.ts  work-session-event.orm-entity.ts
  database/work-session.repository.port.ts  work-session.repository.ts   # append + fold in one tx; seq under row lock; ON CONFLICT DO NOTHING per row
  infrastructure/session-namer.port.ts  anthropic-session-namer.adapter.ts  noop-session-namer.adapter.ts
  infrastructure/session-namer.config.ts        # SESSION_NAMER_PROVIDER, SESSION_NAMER_MODEL, ANTHROPIC_API_KEY
  application/session-dispatch.port.ts          # what relay/ implements: create/stop/restart/close/addCheckout/removeCheckout → host
  application/record-session-events.port.ts     # what relay/ calls with a runner batch
  commands/create-session/       POST /sessions  (Idempotency-Key; ensure project; slug; checkouts; session.requested; dispatch)
  commands/rename-session/       PATCH /sessions/{id}
  commands/stop-session/  restart-session/  close-session/   POST …/stop, …/restart, DELETE /sessions/{id}
  commands/add-checkout/  remove-checkout/                    POST …/checkouts, DELETE …/checkouts/{checkoutId}
  commands/record-session-events/  (no controller; the relay's command)
  commands/name-session/           (no controller; reacts to prompt.first)
  commands/issue-attach-ticket/    POST /sessions/{id}/attach-ticket  (Redis set, 60 s, {sessionId, organizationId, window, userId})
  queries/find-sessions/  find-session/  find-session-events/
  dtos/session.response.dto.ts  dtos/session-event.response.dto.ts
  __tests__/session-state.spec.ts  session-group.spec.ts  session-scoping.spec.ts  work-session.entity.spec.ts
```

- Migration `AddSessions`: the three tables, the composite keys
  `(organizationId, projectId) → project`, `(organizationId, sessionId)
  → work_session`, `(organizationId, installationId) →
  github_installation`, `(id, cwdCheckoutId) → session_checkout
  (sessionId, id) ON DELETE SET NULL (cwdCheckoutId)`, the partial
  uniques, and `(organizationId, idempotencyKey) WHERE idempotencyKey
  IS NOT NULL`.
- Until slice 6, `SESSION_DISPATCH` is bound to a no-op adapter that
  records `session.dispatch_pending`; the slice is still complete
  because every read, write and state rule is testable without a host.
- Tests: the fold is pure and a replay of any log rebuilds `state`
  (property-style over generated event sequences); the group's four
  `waiting-on-you` sources and the debounce-from-recorded-transition
  rule; idempotent create and idempotent event batches (integration);
  the composite keys reject a foreign project and a foreign
  installation (integration, expecting the constraint); E2E
  `e2e/tests/api/sessions.spec.ts` for create, list, stop, events.

## Slice 5 — the console stops stubbing

`packages/frontend/consumer`: `sessions.repository.ts` and
`hosts.repository.ts` drop their hand-rolled DTOs for the generated
`SessionsApi`, `HostsApi`, `InstallationsApi`, `ProjectsApi`; new
`github` module (installations, repositories, branches). `apps/web`:
the hosts settings pane gets the Add-host dialog (intended name →
install command and agent prompt, pairing list with source IP); New
session gets the live repo picker (several, each with a base branch),
the host chip with the online dot and the agent hint; the sessions list
reads the derived group. `apps/web/src/features/sessions/lib/session-stream.ts`
stays fake until slice 6. Each is a feature under
`features/<module>/` per `scaffold-feature`; `pnpm check:structure` and
`pnpm check:bundle` hold.

## Slice 6 — `relay/`: the two sockets

The decided shape is written where it belongs: the wire in 01, the
modules, routes and ports in 03 ("The relay, as built"). What is left here
is the order of work.

- [x] `links/`: the per-host link registry and `RelayDispatchAdapter`
      bound to `SESSION_DISPATCH`; the pending adapter goes.
- [x] `relay/`: `GET /api/v1/relay/runner` and `GET /api/v1/relay/attach`
      as `upgrade` listeners on the API's own HTTP server over `ws`;
      `main.ts` is untouched. (Nest's `@nestjs/websockets` + `WsAdapter`
      was the alternative and is not used: each socket takes its
      credential from the handshake, where Nest's pipeline does not look.)
- [x] `hosts/`: `HOST_PRESENCE` and `HOST_KEY`; `sessions/`:
      `SESSION_LOOKUP` and `SESSION_RECONCILIATION`; `organizations/`:
      `WORKSPACE_LOOKUP`. `packages/backend/cache` gains `take<T>(key)` over
      `GETDEL`.
- [x] `credentials.token` → `credentials.grant`, sealed to the host key.
- [x] Hello reconciliation against the rows.
- [x] The gateway specs run both sockets on a real HTTP server and are
      the coverage the routes get, `route-policy-coverage.spec.ts` not
      seeing an upgrade.
- [ ] Multi-window in the console (the runner handles
      `session.window.open|close`; no route yet).
- [ ] `addCheckout` / `removeCheckout` on the wire (no frame in 01 yet;
      the dispatcher answers `not_supported` on a live link).
- [ ] `attachment.credit` end to end is in place; a credit *policy* on the
      relay (dropping a browser that never credits) is not.

- **Acceptance is the step-one spike gate**
  ([`06-step-one-spike.md`](06-step-one-spike.md)): keystroke echo under
  50 ms median from Barcelona on wifi with the relay in the host's
  region; close and reopen the tab to the same screen; kill and restart
  the runner with the session intact; run `claude` from a phone and log
  in through the printed URL. Measured with the runner slices below in
  place, recorded in 06.

## Runner counterparts (`apps/runner`, separate pull requests)

- **R1, with slice 2** (landed as pull request #21):
  `pairing/adapters/controlplane/client.go` moves to
  `/api/v1/hosts/register` and `DELETE /api/v1/hosts/self`; the boot JWT
  stays an `Authorization: Bearer`; `RotateKey` leaves `Service`
  entirely rather than surviving as a stub, and rotation arrives with
  R2 on the link, as 09 §3 places it. Notes 01 and 03 and the decision
  log are reconciled in the same pull request.
- **R2, with slice 6**: `internal/link` — the `Link` port's adapter:
  outbound dial with the boot JWT as a bearer, hello with the protocol range
  and the session snapshot, 15 s heartbeat, the 4-byte framing, the
  reconnect ladder with its epoch, `credentials.token` answered to the
  helper socket; `internal/credentials` replaces the empty helper;
  `apikeys` and the TCP `/v1/ws` retire. Types come from
  `packages/go/protocol`, generated from slice 0's Zod.
- **R3, with slice 6**: sessions on the note 10 layout —
  `workspaces/<org>/projects/<project>/{repos,sessions}`, the
  `.oppenheimer` marker first, bare stores found by
  `oppenheimer.repo-id`, several checkouts, `prompt.first` from the
  agent transcript, `<runId>:<n>` idempotency keys, report-not-reap on
  boot (02 §5, §11).

## Decisions this plan forced back into the notes

- The runner already speaks `POST /v1/hosts/register` and note 10 said
  `/hosts/pairing/redeem`; three notes and the code agreed, so note 10
  moves. Both are under the API's `/api/v1` prefix; the runner's client
  gains the `/api` segment.
- Uninstall is a second HTTP call, `DELETE /hosts/self`, so "exactly one
  HTTP call" in note 10 becomes two, which is what 01 always said.
- The host assertion stays an `Authorization: Bearer` and the API's
  credential resolver learns the host kind; a first draft of this plan
  put it in a private header, and the owner's review of R1 sent it back.
  It keeps the runner's five-minute lifetime; the `jti` is burned for
  that lifetime rather than shortening the token, so a replay is refused
  either way and a slow dial is not.
- Hints are 01's closed set on the link, plus `host_offline` on the
  attach ticket only; two schemas, not one.
- The wire schema is Zod first, JSON Schema emitted, Go generated (01
  open question 1), and `events.append` / `events.ack`,
  `attachment.credit` and `credentials.grant` are written into 01's
  "what rides the link" because 01 owns the wire.
- No `Repository` subject and no `attach` verb: the owner's review of
  the shared package caught both as vocabularies that lived only in one
  place, and the hosts, GitHub and sessions slices were re-briefed.
