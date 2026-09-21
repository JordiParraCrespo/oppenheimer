# New session: the screen, its components, and the wire behind it

Build `/sessions/new` — the host, repository+branch and agent chips over a
composer — and connect it to the control plane's `POST /sessions`, then prove
the whole path with a real browser against a real API and a real database.

This plan answers one question first, because it is the one that was asked:
**how the screen is cut into components.** Everything after that is the wiring
each component needs, and how the result is verified.

---

## 1. Where things already stand

| Layer | State |
| --- | --- |
| Design system (`design-system-web`) | **Done.** `ChipSelect`, `RepositorySelect` (multi-repo, branch pane), `AgentModelSelect`, `Composer`, `PermissionMenu`, `EffortSlider` are all cut to the version-1 artboard. |
| API (`apps/api`) | **Done.** `POST /sessions` (multi-checkout, `Idempotency-Key`), `GET /sessions`, `GET /hosts`, `GET /installations/:id/repositories`, `GET /installations/:id/repositories/:repoId/branches`. |
| `@oppenheimer/api-client` | **Generated** and already carries `createSession`, `listInstallationRepositories`, `listRepositoryBranches`, `findHosts`. |
| `@oppenheimer/frontend-consumer` | **Stale.** `SessionEntity` still models one repo + one branch and the old `running/idle/stopped` vocabulary; `SessionsRepository` hand-rolls URLs against a DTO the API no longer sends; there is no branches read. |
| `apps/web` `/sessions/new` | **Placeholder.** An `EmptyState` saying "the session form lands once a host is paired". |
| Relay (browser ⇄ host PTY) | **Not built.** `PendingSessionDispatchAdapter` answers every dispatch with `host_offline`, and the terminal is a recorded replay. |

Two consequences worth stating up front: the consumer package has to be
re-aligned before the screen can read anything true, and **the first prompt
cannot reach an agent yet** — there is no socket to write it to (see §5).

---

## 2. How the screen is cut

Four layers, and the rule that puts each piece in its layer
(`.agents/rules/frontend-architecture.md`).

```
design-system-web            ChipSelect · RepositorySelect · AgentModelSelect · Composer
        ▲
features/sessions/components/   host-select · repository-branch-select · branch-select
        │                       agent-select · new-session-composer      (props in, events out; never fetch)
        ▲
features/sessions/sections/     new-session-form            (owns the queries + the create mutation)
        ▲
features/sessions/screens/      new-session                 (title, subtitle, the section)
        ▲
routes/_authenticated/sessions/new.tsx
```

### 2.1 `components/` — one file per select, and none of them fetch

Each is a pure function of entities in and a callback out. That is what makes
them testable without a query client, and it is what the layout contract wants:
`components/` is forbidden to fetch, so the section above passes the rows, the
pending flag and the error down.

| File | Renders | Props |
| --- | --- | --- |
| `components/host-select.tsx` | `ChipSelect` | `hosts: HostEntity[]`, `value`, `onValueChange`, `isPending`, `onAddHost` |
| `components/repository-branch-select.tsx` | `RepositorySelect` | `repositories: RepositoryOptionInput[]`, `value: CheckoutDraft[]`, `onValueChange`, `isPending`, `onConnectMore` |
| `components/branch-select.tsx` | `ChipSelect` | `branches`, `value`, `onValueChange` — rendered **only** while exactly one repository is selected, which is the only time a lone branch chip tells the truth |
| `components/agent-select.tsx` | `AgentModelSelect` | `value`, `onValueChange`, `hostCapabilities?` |
| `components/new-session-composer.tsx` | `Composer` | `onSubmit(text)`, `busy`, `disabled`, and the chip row as `tools`/`engine` slots |

Three notes on specific ones:

- **`host-select`** shows `host.name` with `host.summary` (`mac-studio · macos`)
  as the muted second line and the online dot; the foot action is "Add host…".
- **`repository-branch-select`** is the multi-select the design asks for: rows
  toggle, each selected row grows a branch cell, and the chip reads
  `xrp-mobile +1`. It takes repositories from **every** connected installation,
  merged and keyed by `installationId:githubRepoId` — `githubRepoId` alone is
  not unique across two installations, and the create call needs both halves
  anyway.
- **`agent-select`** feeds `AgentModelSelect` from the frozen
  `CODING_AGENTS` catalog in `@oppenheimer/shared`. The catalog carries no
  model lists, so each agent is the component's "picked outright" case and the
  button names the agent. Whether *this host* has the agent on `PATH` is a host
  capability and is shown as a hint, never a gate — the catalog's own rule.

**The composer owns its text.** The draft never becomes a prop of the section,
or every keystroke re-renders three lists. It calls `onSubmit(text)` and the
section, which holds the scope, does the rest.

### 2.2 `lib/` — the mappers, pure and unit-tested

`lib/session-options.ts`: `HostEntity[] → ChipSelectOption[]`,
`RepositoryEntity[] + branches → RepositoryOption[]`, `CODING_AGENTS →
AgentOption[]`, and `CheckoutDraft[] → CreateSessionInput['checkouts']`. No JSX,
no React. This is where the "which id is which" confusion is contained, and
`__tests__/session-options.spec.ts` is what keeps it contained.

### 2.3 `hooks/` — state and the queries that depend on state

- `hooks/use-new-session-draft.ts` — the draft (`hostId`, `checkouts`,
  `cwdGithubRepoId`, `agent`) and its **last-choice memory**: the artboard says
  chips remember, so the draft is seeded from `localStorage` and validated
  against what the queries actually returned (a remembered host that has been
  unpaired must not stick).
- `hooks/use-checkout-branches.ts` — branches are per repository and only matter
  once a repository is selected, so this is a `useQueries` over the *selected*
  checkouts, not a read of every repo on the account.
- `hooks/use-scope-prefill.ts` — first visit after onboarding lands with the
  host just added, the first repository of the installation, its default branch
  and Claude Code already chosen (`05-screens.md`).

### 2.4 `sections/new-session-form.tsx` — the one place that fetches and mutates

Subscribes to `useHosts`, `useInstallations`, the repositories of each
installation and `use-checkout-branches`; holds `useCreateSession`; renders the
chip row and the composer. On submit: build the body, mint an
`Idempotency-Key`, `POST /sessions`, then `navigate({ to: '/sessions/$sessionId' })`.
Handing query results down to `components/` children is the intended flow and
passes `pnpm check:structure`; handing them to another *section* would not.

### 2.5 The screen and the route

`screens/new-session.tsx` keeps the export's column (720px, 48px over 32px) and
the heading, and mounts the section. The route file is unchanged — it already
exists and is already `pane: 'full'`.

---

## 3. What has to change underneath (`packages/frontend/consumer`)

The screen cannot be connected to a module that models a different product.

1. **`modules/sessions/session.entity.ts`** — model what the API sends:
   `slug`, `projectId`, `agent`, `state` (the derived **group**: `working`,
   `waiting-on-you`, `ready-for-review`, `landing`, `idle`, `resolved`),
   `lifecycle` (`starting`, `open`, `failed`, `resolved`), `cwdCheckoutId`,
   `checkouts: SessionCheckout[]`, `hints`. `CreateSessionInput` becomes the
   shape of `createSessionSchema`: `{ hostId, agent, checkouts[], cwdGithubRepoId?, name?, projectId? }`.
2. **`modules/sessions/sessions.repository.ts`** — drop the hand-written DTO and
   the raw URLs; call the generated `createSession` / `findSessions` /
   `findSession` / `stopSession`, and pass the idempotency key through.
3. **`modules/installations/`** — add `branches(installationId, githubRepoId)`
   over `listRepositoryBranches`, plus a `BranchEntity`.
4. **`react/installations.queries.ts`** — `useRepositoryBranches`, and a
   `useRepositoryBranchesMany(pairs)` built on `useQueries` for the selected set.
5. **Callers of the old vocabulary** — `sessions-sidebar.tsx` (its `DOT` map is
   keyed by the retired states), `screens/session.tsx` (`state === 'starting'`,
   `isLive`), `sections/session-provisioning.tsx`, and the `sessions.state.*`
   translations. This is a required consequence of (1), not extra scope.

No API change is needed for the create path. `projectId` is optional and the
control plane creates the project on the spot from the first checkout's
repository.

---

## 4. Translations, i18n, a11y

New keys under `sessions.new.*` in `packages/translations/{en,es}/index.json`
(chip placeholders, search placeholders, empty lines, the add-host action, the
submit error), and the retired `sessions.state.*` set replaced by the group
vocabulary. Every select takes an `aria-label`; the chip row is a `role="group"`
labelled by the heading.

---

## 5. Settled: the API comes first

The three questions this plan opened with are answered, and the answers
move work **before** the screen rather than around it. They are designed
in [`product/versions/mvp/12-session-launch.md`](../product/versions/mvp/12-session-launch.md):

- **The foot row is built in full**, so `POST /sessions` grows a `launch`
  object — model, permission level, effort — folded onto `work_session`
  so a restart and the engine button can read it per row.
- **The composer's text is the session's first task.** `POST /sessions`
  grows `prompt`: appended as `prompt.first` by the API (keyed so the
  runner's own later report dedupes against it) and carried on
  `session.create`, so the host types it into window 0 at launch. Nothing
  about the composer waits on the relay.
- **The name comes from that prompt**, through a new
  `openai-compatible` namer provider — one adapter for Groq, Together,
  vLLM, Ollama and the rest — called after the 201 and never awaited.
- **The agent chip gets real model lists**: the shared catalog grows
  `models` and a `launch` record mapping each permission level and effort
  stop to that CLI's own flags. No endpoint; the console already imports
  the catalog.

So stage 0 below is the API slice, and the component work in §2 is
unchanged except that `components/agent-select.tsx` now has models to
show, and two more components join it:
`components/permission-select.tsx` (`PermissionMenu`) and
`components/effort-select.tsx` (`EffortSlider`).

## 6. Verifying it end to end

The container has no Docker, but it has PostgreSQL 16 binaries, `redis-server`,
a reachable npm registry and a pre-installed Chromium — so a real stack is
possible without the compose file:

1. `initdb` a cluster on a local path, start it; start `redis-server`; `pnpm install`.
2. Run the API's migrations, start `apps/api` and `apps/web`.
3. `pnpm test` (unit, including the new mapper tests), `pnpm arch`,
   `pnpm check:structure`, `pnpm check`, `pnpm check:bundle`.
4. **`e2e/tests/web/new-session.spec.ts`** (new): sign up, pair a host through
   the API, open `/sessions/new`, pick a host, pick a repository, change its
   branch, pick the agent, type a task, submit, and land on
   `/sessions/{id}` with the session in the sidebar. Then assert the row the API
   actually stored.

**The one thing that cannot be real is GitHub.** Repositories and branches are
answered live by GitHub through an App installation, and this deployment has no
App — which is exactly why the existing `e2e/tests/api/sessions.spec.ts` skips
its create path. Two ways out:

- **(A) A fake GitHub, recommended.** The REST adapter hardcodes
  `https://api.github.com`; make it a config value (`GITHUB_API_URL`, defaulting
  to the same) and point the e2e API at a small stub that serves the App's
  installation, repository and branch endpoints. Everything else in the test —
  browser, web app, API, guards, Zod pipe, Postgres — is the real thing. The env
  var is defensible on its own: GitHub Enterprise Server needs it.
- **(B) Route-mocking in the browser.** Playwright stubs the four `/api/v1/…`
  responses. It proves the UI wiring and nothing below it, and the create call
  would have to be stubbed too, since the API validates the repository against
  GitHub. Cheaper, and much weaker.

**(A) is chosen.** (B)'s shape is kept only if a fast UI-only spec earns its
place later.

---

## 7. Order of work

| Stage | Deliverable | Gate |
| --- | --- | --- |
| 0 | The API slice of note 12: shared schemas + catalog + protocol, the migration and the fold, the create handler's prompt entry and naming call, the `openai-compatible` namer, then `pnpm generate:api-client` | `pnpm test`, `pnpm test:integration`, `pnpm check:api-structure` |
| 1 | Consumer package re-aligned (entity, repository, branches, hooks) + callers fixed | `pnpm test`, `pnpm arch` |
| 2 | `lib/session-options.ts` + its tests | `pnpm test` |
| 3 | The seven `components/` and their render specs | `pnpm test`, `pnpm check:structure` |
| 4 | `hooks/` + `sections/new-session-form.tsx` + the screen, translations | `pnpm check`, `pnpm check:bundle` |
| 5 | `GITHUB_API_URL` + the e2e GitHub stub | API integration tests still green |
| 6 | The stack up, the web e2e spec, the full check run | everything above, green |
| 7 | Changesets, push, PR | CI |

## 8. Risks

- **The consumer re-alignment is wider than the screen.** It touches the
  sidebar, the session screen and the provisioning pane. Unavoidable: they read
  a shape the API stopped sending.
- **`GITHUB_API_URL` is a production change made for a test.** It is small and
  independently useful, but it is a change, and it belongs in its own commit.
- **A created session sits at `host_offline` forever** without a runner, so the
  e2e assertion stops at "the row exists, the pane is provisioning". The agent
  actually starting is the relay's slice.
