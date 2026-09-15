# QA scenario pack — porting the strategy from adri-rodrigo-seo-crm

## Lineage

The strategy originates in [openclaw/openclaw](https://github.com/openclaw/openclaw)'s
`qa/` directory: a repo-backed scenario pack (`qa/scenarios/index.yaml` plus
one `scenarios/<theme>/<slug>.yaml` per runnable scenario), a `qa suite`
that runs the selected set and writes `qa-suite-report.md` / `qa-evidence.json`,
`qa coverage` as the inventory, and a `maturity-scores.yaml` that scores each
surface separately from coverage. adri-rodrigo-seo-crm ported that shape into
a product-shaped pack for a CRM: same file layout, same commands, but
Playwright specs bound by id instead of OpenClaw's YAML `flow` runner, and
seeded Postgres fixtures instead of gateway config patches.

What OpenClaw has that the CRM port dropped, and what to do with each here:

| OpenClaw piece                                                    | CRM port | oppenheimer decision                                                                                                     |
| ----------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `coverage.primary` / `secondary` ids from a `taxonomy.yaml`        | dropped  | **Carry.** A small `qa/taxonomy.yaml` of `surface.feature` ids (auth.password-reset, permissions.self-escalation…). |
| `docsRefs` / `codeRefs` on every scenario                          | dropped  | **Carry.** Cheap, and `qa coverage --match <path>` becomes possible: touched a file, find the scenario that proves it. |
| `execution.kind: vitest \| playwright \| script` + `execution.path` | dropped  | **Carry as `playwright` only.** Lets an existing `e2e/tests/web/*.spec.ts` count as a scenario's evidence without rewriting it. |
| `suiteIsolation` / `parallelSafe`                                  | dropped  | Skip. The pack runs with one worker; fixtures own their organizations.                                                |
| Kickoff mission, operator identity, agent-driven `qa manual`       | dropped  | Skip. No agent runs this pack; a person reads the report.                                                             |
| Maturity as quality/completeness scores per surface                | reduced to `depth` + `not-yet` | Keep the CRM's honest prose form; add a numeric `completeness` only once a theme has more than five scenarios.         |
| Provider modes, live channel lanes, Convex credential pool         | dropped  | Not applicable.                                                                                                       |

## What is being ported

`adri-rodrigo-seo-crm` carries a `qa/` workspace package (`@oppenheimer/qa`) that is
not a second unit-test suite and not a second e2e suite. It answers a different
question — "if a person signed up this morning, would the first screen tell them
the truth" — and it has its own equipment for it:

| Piece                       | What it is                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `qa/scenarios/**/*.yaml`    | The claims. One file per scenario: id, theme, severity, fixture, intent, steps, expected, promised screenshots.  |
| `qa/scenarios/index.yaml`   | What a single scenario cannot say: environment URLs, the fixture catalog, themes, and the standing principles.   |
| `qa/specs/**/*.spec.ts`     | Playwright specs. `scenario('DASH-01', …)` is the only registration; coverage is discovered by grepping for it.  |
| `qa/fixtures/`              | Named database states (`baseline`, `volume`, `empty`, `workbench`, `roster`, `reset`), each owning its own org.  |
| `qa/src/harness.ts`         | `ScenarioRecorder`: `check` records and carries on, `shot`/`shotOf` are evidence, verdicts written per scenario.|
| `qa/src/cli.ts`             | `qa env`, `qa fixture`, `qa suite [--theme]`, `qa coverage`, `qa report`.                                        |
| `qa/src/report.ts` + `results-reporter.ts` | Merge verdicts into `artifacts/report.md` (screenshots inline) and `artifacts/results.json`.        |
| `qa/src/mail-sink.ts`       | Reads reset/invitation links out of the API log (`EMAIL_PROVIDER=console`). Counts first, waits for one more.   |
| `qa/bin/qa-env.sh`          | Brings up Postgres, Redis, API on 3001, web on 3000; docker compose first, local Postgres/Redis as fallback.      |
| `qa/maturity.yaml`          | Per theme: what the pack reaches and what it does not yet. Separate from coverage on purpose.                    |
| `qa/taxonomy.yaml` (new)    | Coverage ids a scenario may claim, so `coverage --match` can answer "what proves this file". From OpenClaw.       |

The strategy underneath, which is the part that has to survive the port:

1. **Claims first.** A scenario exists as YAML before it has a spec, and
   `qa coverage` lists unimplemented ones instead of letting them count as green.
2. **Fixtures are states, not setup.** Each fixture builds a whole organization,
   rebuilds rather than tops up, and is picked by signing in as its owner. The
   fixture owner is a tenant administrator, never a platform one, so the oracle
   is the tenant's rows and not the whole database.
3. **Record, don't stop.** `qa.check` collects every finding; `expect` only when
   nothing further can be checked. A recorded failure still fails the run.
4. **The screenshot is the evidence.** 1440×900 at 2×, viewport only, with the
   pixels below the fold counted and written into the report as a note.
5. **Principles are failures.** A placeholder number is a failure. An error must
   be legible and a refusal must read differently from a breakage. A run must be
   repeatable twice in a row.
6. **Oracle over rendering.** Numbers on screen are compared with a direct query
   against Postgres, scoped to the same organization.

## Why oppenheimer needs it now

- `apps/web/src/routes/_authenticated/dashboard.tsx` renders hardcoded
  `128`, `24`, `1,420` and `99.9%`. That is exactly the "placeholder number"
  the pack's first principle refuses to pass, and CLAUDE.md already says never
  to render one. The first dashboard scenario will be red on day one, which is
  the point.
- `e2e/` is a regression suite (parallel, minted accounts, screenshots only on
  failure). It cannot produce a report someone triages, and it does not check a
  screen against the database. The two suites answer different questions and
  should coexist, as they do in the CRM repo (`qa/` beside `apps/web/e2e`).
- oppenheimer now has two front doors — `apps/web` on 3000 and `apps/admin-web`
  on 3003 — and the permissions theme ("what can this kind of person actually
  do, measured by signing in as them") is the only thing that will state the
  truth about that split.

## Differences that change the port

| In the CRM pack                                              | In oppenheimer                                                                                                 |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Dashboard oracle = leads, domains, members, qualified counts | No leads/domains product. Oracle = members, teams, pending invitations, API tokens, sessions of the org.   |
| Fixture seeds: `organization, members, domains, leads, inbox` | Seeds: `organization, members, teams, invitations, apiTokens`. Drop domains/leads/inbox seeders.            |
| Fixture owner role `qa-agency-owner` with Lead/Domain/Mail    | Role with `manage Member/Invitation/Team/ApiToken`, `read Organization/Workspace`, still no `manage all`.   |
| Roster cast: owner, admin, plain member, domain-scoped member | Owner, admin, plain member, **platform admin** (`user.role = admin`) for the control plane, no scoped one.  |
| One web app on 3000                                          | Two: `web` on 3000 and `admin-web` on 3003. `index.yaml` gains `adminWeb`; the harness gets `adminPage`.    |
| Sign-up creates account, fixture builds org by SQL           | Same model (`/onboarding`). Reuse `e2e/support/web.ts#createOrganization` shape, but through the API.       |
| `signIn` lands on `/dashboard`                               | Same for `apps/web`; `admin-web` lands on `/users` and refuses non-platform roles with `AccessDenied`.       |
| Mail sink reads `[PASSWORD RESET]` / `[INVITATION]` lines    | `e2e/support/mail.ts` already parses the console provider's output; lift its regexes into `mail-sink.ts`.   |
| `qa-env.sh` builds then `pnpm --filter @oppenheimer/api start`     | Same, plus `pnpm --filter @oppenheimer/api migration:run` before start (oppenheimer's API does not migrate on boot).     |
| `.env` needs `INTEGRATIONS_ENCRYPTION_KEY`                   | Not present in oppenheimer. Only `BETTER_AUTH_SECRET` and `EMAIL_PROVIDER=console` are required.               |

## Status

Phases 0-2 are built and running: the pack, its fixtures and the eight auth
scenarios live in `qa/`, and the first pass is published under
`docs/screenshots/qa-auth-pass/` at 7 passed, 1 failed. Phases 3-5 below are
still plans.

## Phases

### Phase 0 — wiring (one PR, no scenarios yet)

- Copy `qa/` verbatim from the CRM repo, then delete the CRM-specific pieces:
  `fixtures/seed.ts` seeders for domains/leads/inbox, `specs/dashboard/*`,
  `specs/permissions/*`, and every `scenarios/**/*.yaml`.
- Keep `src/` untouched except `paths.ts` (no change), `harness.ts` (add
  `ADMIN_WEB_URL` and an `adminPage` in `ScenarioContext`), `db.ts` (replace
  `organizationCounts` with oppenheimer's oracle counts).
- Add `"qa"` to `pnpm-workspace.yaml`, `!**/qa/artifacts` to `biome.json`
  overrides, and `qa/artifacts/` to `.gitignore`.
- `qa/bin/qa-env.sh`: drop the `INTEGRATIONS_ENCRYPTION_KEY` line, add the
  migration step, start `admin-web` on 3003 next to `web`, and wait for it.
- `qa/playwright.config.ts`: keep `workers: 1`, `retries: 0`, 1440×900 at 2×,
  `/opt/pw-browsers/chromium` fallback. Add a second `use.baseURL`-less project
  is not needed: scenarios that touch the control plane navigate by absolute
  `ADMIN_WEB_URL`.
- Rewrite `qa/README.md` for oppenheimer (the "fixtures had to learn the hard way"
  section stays: the ownership rule and the tenant-admin rule both apply here).
- `scenarios/index.yaml`: `pack: oppenheimer — auth, permissions & dashboard QA`,
  environment with `web`, `adminWeb`, `api`, `apiHealth`, `mailSink: log`.
- `src/scenarios.ts`: extend the schema with OpenClaw's `coverage: {primary, secondary}`,
  `docsRefs`, `codeRefs` and optional `execution: {kind: playwright, path}`;
  validate coverage ids against `qa/taxonomy.yaml`. `cli.ts` gains
  `coverage --match <query>` over ids, titles, refs and coverage ids, and
  `suite` runs `execution.path` specs from `e2e/` for scenarios that declare one.
- Acceptance: `pnpm --filter @oppenheimer/qa coverage` prints an empty inventory,
  `qa/bin/qa-env.sh up` reaches `ready`, `pnpm --filter @oppenheimer/qa lint` passes.

### Phase 1 — fixtures

Accounts in `fixtures/accounts.ts`, all on `@qa.oppenheimer.dev` so `reset` can be
exhaustive and can never touch the platform seed's `@oppenheimer.dev`:

| fixture     | seeds                                            | volume                                         | why                                                                |
| ----------- | ------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------ |
| `reset`     | none                                             |                                                | delete the pack's transient invitees and newcomers                 |
| `empty`     | organization, members                            | 1 member                                       | the first sign-in; the state most likely to render a fake number   |
| `baseline`  | organization, members, teams, invitations, tokens | 12 members, 3 teams, 4 pending invites, 5 tokens | every region of dashboard/team/settings has something real       |
| `volume`    | same                                             | 2,000 members, 60 teams, 300 invites           | unbounded member lists, pagination, unformatted counts             |
| `workbench` | same                                             | 5 members, 2 teams                             | the mutating themes (team, settings, tokens) write here freely     |
| `roster`    | organization, members, roster                    | 6 members                                      | one holder of each role, including one platform admin              |

Implementation notes carried over from the CRM pack:

- `ensureOwner` signs up through `POST /api/auth/sign-up/email` with an
  `Origin` header so the hash matches what login verifies; then builds the org
  by SQL the same way `/onboarding` would (`organization`, `member` with
  `role = owner`, default team). Roster-only members are written straight to
  `user` with no credential account.
- `grantTenantOwnerRole` inserts the `qa-tenant-owner` role with an explicit
  permission list and removes the default `user` role. `user.role` stays `user`.
  The one exception is the roster's platform admin, whose `user.role` is set to
  `admin` on purpose so the control plane admits them.
- Applying rebuilds: delete the fixture's organization cascade, then re-seed.

### Phase 2 — auth theme (port, mostly unchanged)

The case-by-case plan is in [qa-auth-scenarios.md](qa-auth-scenarios.md).

Port the six CRM scenarios and their specs; the flows exist in oppenheimer and
`e2e/tests/web/*` already proves the selectors:

- `AUTH-01` super admin identity, elevated not merely named (control plane
  admits, consumer app shows no admin chrome).
- `AUTH-02` password reset end to end via the mail sink; old password refused,
  link not replayable, **sessions revoked** (oppenheimer fix #114 — add a check).
- `AUTH-03` invitation at owner-picked roles, autologin, stored role, later
  sign-in.
- `AUTH-04` self-service first run: register → `/onboarding` → first
  organization → dashboard.
- `AUTH-05` negative paths: wrong password, unknown email, expired reset link,
  reused invitation, guarded route while signed out, guarded route as the wrong
  role.
- `AUTH-06` tenant isolation: baseline owner reads the team page while volume
  holds the data; counts must be baseline's, not the union.

### Phase 3 — permissions theme

Port `roles.ts` (sign in through the API sharing the page's cookie jar,
`permissionsOf` from `/api/v1/users/me/permissions`, `allows` including
`manage:all`) and the three implemented CRM scenarios, re-targeted:

- `PERM-01` landing screen per role, on **both** apps: consumer roles land on
  `/dashboard`; platform admin lands on `/users` in admin-web; a plain member
  opening admin-web gets the `AccessDenied` card, not a blank shell or a 500.
- `PERM-02` navigation honesty: every sidebar entry in `apps/web` and
  `apps/admin-web`, opened for every role, compared with the read behind it.
- `PERM-03` API surface per role against the reported permission set, both
  directions; a refusal is 401/403 and a problem+json document, never a 500.
- `PERM-04` no self-escalation: a member cannot promote themselves, cannot edit
  their own roles via `PUT /users/:id/roles`, cannot mint a token with scopes
  they do not hold (`scopes-and-credentials.md`).
- `PERM-05` role change reaches an open session (write as YAML, mark not-yet).

### Phase 4 — dashboard and team themes

- `DASH-01` every KPI agrees with Postgres. Today the four cards are literals;
  the scenario is written against the intended cards (members, teams, pending
  invitations, active sessions) and stays red until the dashboard reads them.
  Do not soften the scenario to match the screen.
- `DASH-02` the same at `volume`, with the read timed and noted.
- `DASH-03` empty state region by region: `EmptyState`, never a zero badge.
- `DASH-04` failure modes routed in the browser: 500, unreachable, 403, slow.
  `Alert` for errors, refusal reads differently from breakage.
- `TEAM-01..03` in `workbench`: invite, change role, remove; each checked
  against `member`/`invitation` rows and screenshotted.

### Screenshots — both kinds the CRM keeps

The evidence is not optional in any phase. Two things, done exactly as the CRM does them:

**1. Every verdict takes a laptop screenshot.** `ScenarioRecorder.shot` and
`shotOf` come across unchanged: viewport 1440×900 at `deviceScaleFactor: 2`,
written as a 2880×1800 PNG, no `fullPage`. After each capture the harness
measures the app's inner scroll container and, when more than 24px sits below
the fold, writes a note into the report instead of cropping silently. A scenario
declares the files it promises under `artifacts:` in its YAML, and the report
embeds every one inline next to the checks. oppenheimer's shell is the same
`h-svh` inner-scroller pattern as the CRM's, so the below-the-fold measurement
applies as is. Run output lands in `qa/artifacts/screenshots/`, git-ignored.

Two names per scenario is the norm: the whole screen (`dash-01-baseline-dashboard`)
and the region the claim is about (`dash-01-kpis`, framed with `shotOf`). The
admin control plane gets its own shots on the `adminPage`, named `admin-…`.

**2. Each QA pass commits a curated set under `docs/screenshots/<pass>/`.**
The CRM keeps `docs/screenshots/qa-dashboard-auth-pass/` with every PNG the
run produced, the run's `report.md` copied in as `run-report.md` with its
image links rewritten from `screenshots/…` to `./…`, and a README that says
which run it was, the pass/fail count, which failure is the product and which
is the pack, and a table naming the three or four captures that settle a
question faster than a paragraph. The rest go under "Everything working".

For oppenheimer the first such folder is `docs/screenshots/qa-auth-dashboard-pass/`,
committed with the Phase 4 PR, and it must include the **before** capture of
the placeholder-number dashboard: the CRM's README points at its directory
history for the screenshots that documented the original findings, and the
issues opened from the run link to them. A second folder,
`docs/screenshots/qa-permissions-pass/`, ships with Phase 3 and holds one
landing-screen shot per role on both apps, including the `AccessDenied` card a
plain member sees in admin-web.

Budget: the CRM folder is 14 MB for 29 PNGs. Keep each pass under 20 MB, and
add `qa/artifacts/` to `.gitignore` so only the curated copy is versioned.
Add a `qa publish <pass-name>` subcommand to `cli.ts` that does the copy and
the link rewrite, since doing it by hand is how the CRM README says the links
break.

### Phase 5 — maturity, docs, CI

- `qa/maturity.yaml` filled honestly per theme, with a `not-yet` list (OAuth,
  email verification, session expiry, rate limiting, mobile apps).
- `apps/docs`: one page under Testing describing the pack, linking the report
  and embedding the curated captures from `docs/screenshots/`.
- CI: a manual `workflow_dispatch` job `qa-pack` that runs `qa-env.sh up`,
  `qa suite`, and uploads `qa/artifacts` — not on every PR. The CRM repo runs
  it by hand; the same posture here, since a run takes minutes and its output is
  a report to read, not a gate.

## Order of PRs

1. Phase 0 + Phase 1 (`feat(qa): add the scenario pack runner and fixtures`).
2. Phase 2 (`test(qa): auth theme`).
3. Phase 3 (`test(qa): permissions theme across web and admin-web`).
4. Phase 4, together with the dashboard fix it finds
   (`test(qa): dashboard and team themes, and stop rendering placeholder KPIs`).
5. Phase 5.

Each PR must leave `qa coverage` with no silently-unimplemented scenario it
did not declare in `maturity.yaml`.

## Out of scope

- Mobile and admin-mobile: no browser to drive; leave for a later theme.
- Replacing `e2e/`: it stays. If a check is a regression guard, it goes there;
  if it is a claim someone triages from a report, it goes in `qa/`.
- The sites pipeline QA (`pipeline/scripts/qa.mjs`) in the CRM repo is about
  built Astro HTML and has nothing to port.
