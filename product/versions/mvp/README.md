# MVP design

In-depth design of the MVP defined in [`../../07-mvp.md`](../../07-mvp.md).
One document per area, in the order they unblock each other. Each
document opens with what is already decided in the research notes,
then the questions still open. Decisions made here are final for the
MVP; when one changes, update the document and add a line to the log
at the bottom of this file.

A bare number is a document in this directory (`02 §6`, `09 §5`);
"note 9" with the word is a research note in [`product/`](../../README.md).

| # | Document | Covers |
|---|----------|--------|
| 00 | [Scope](00-scope.md) | The exact feature list, in and out, and the demo scene it must satisfy |
| 01 | [Protocol](01-protocol.md) | **The wire**: the two sockets and their two shapes, frame layout and the attachment id, hello, heartbeat, hints, the command list, and which calls are HTTPS instead |
| 02 | [Runner](02-runner.md) | The Go binary: process shape, subcommands, package map, the link, sessions, tmux, streaming, credentials, screen manifests, state, failure modes |
| 03 | [Control plane](03-control-plane.md) | Data model, API, relay, GitHub App, token minting, and the runner-facing surfaces: register, host JWTs, the link's server half, release rollout |
| 04 | [Guest image](04-guest-image.md) | Deferred with the VM slice; kept for later |
| 05 | [Screens](05-screens.md) | Sign-in, sidebar, Create session, session view, settings drawer; components and states |
| 06 | [Step-one spike](06-step-one-spike.md) | Exactly what to build in week one and how the latency gate is measured |
| 07 | [Security checklist](07-security-checklist.md) | The findings from note 04 that the MVP must satisfy, as a checklist |
| 08 | [Auth](08-auth.md) | Identity, the personal workspace, host ownership, session attach; one page instead of the starter's kernel design |
| 09 | [Runner install and update](09-runner-install-and-update.md) | The install command, the agent prompt, pairing, the user service, signed releases, self-update and rollback |

## Decision log

- 2026-09-12: directory created; documents seeded with decisions from
  the research notes and open questions.
- 2026-09-12: review fixes: Ephemeral lifecycle stated in scope; sleep
  scheduling aggregated per runtime VM with `runtime_vms` in the data
  model; security checklist F15 and F16 rewritten for libvirt/QEMU.
- 2026-09-12: **MVP reset to Orca-on-the-web without VMs.** Sessions
  run directly on hosts you own (direct mode), one worktree plus a tmux
  terminal each. Claude Code first, Codex next. No sleep tiers, no
  account objects, no guest image in the MVP; all VM design is deferred
  to the next slice, not deleted. Only `workspaces/` exists under
  `~/oppenheimer-ai` for now.
- 2026-09-12: sign-in is GitHub, Google, and email plus password on
  day one from a base auth project; Connect GitHub is a separate step.
  Tabs are tmux windows in one tmux session per session on a dedicated
  tmux socket. No inbound ports on hosts, relay only, Tailscale
  optional. Pairing by pasted command with a one-hour single-use token,
  plus a copyable agent install prompt served by the control plane.
  Onboarding is four screens ending on the real New session screen.
- 2026-09-15: the code starts from the Flama starter, so the control
  plane is NestJS plus TypeORM, not Hono plus Drizzle (03). The personal
  workspace is one `organization` row per account created at sign-up;
  the starter's leads and billing modules are not composed. 08-auth.md
  added as the one-page auth note for the MVP.
- 2026-09-18: the notes and the code disagreed about whether the console
  creates organizations, and the notes were the stale half. `/onboarding`
  is the console's one organization-creating screen and stays: it is the
  recovery path for an account whose best-effort sign-up hook did not
  provision a workspace, it creates only the caller's own, and an account
  with none cannot open any product screen until it does. "No roster, no
  invitations, no teams" is unchanged. Recorded in 08-auth.md, root
  `AGENTS.md` and `.agents/rules/rbac-roles.md`. 08-auth.md also now
  records that provisioning is gated on *membership* rather than
  ownership, which the MVP cannot tell apart and the teams slice will.
- 2026-09-18: the runner is designed in full (02): one binary with
  subcommands, no inbound port and a 0600 Unix socket for the credential
  helper and the CLI, one multiplexed link with a 4-byte stream header on
  binary frames, a snapshot on reconnect instead of a durable outbox, and
  a package map onto `apps/runner`'s hexagon. That map answers 02's open
  question 6 and 01's open questions 3, 4 and 5. Pairing and the agent
  install prompt keep their decisions word for word but move from 02 to 09,
  where the rest of the install story is.
- 2026-09-18: **signed self-update moves into the MVP** and gets its own
  note (09). It was in 00's out-list as "signed auto-update"; a host that
  can only be updated by the user pasting a command again is a support
  burden the first ten hosts already cannot carry, and the protocol needs
  the update-required hint anyway. F26 therefore moves from deferred into
  07's checklist. The shape: artifacts signed with an offline key whose
  public half is compiled into the binary, a manifest the control plane
  serves but cannot forge, a safe window, selfcheck before the swap, a
  health gate and automatic rollback.
- 2026-09-18: review pass on the design, and the notes moved to match it.
  01 now owns the wire — 02 §4 had grown a second copy of it — and names
  the **attachment** (one PTY on one window for one browser connection)
  as what the 4-byte stream id identifies; the two sockets have two
  shapes on purpose. Registration, uninstall and the release manifest are
  ordinary HTTPS, which is what lets a runner the control plane refuses
  on protocol grounds still fetch the version that fixes it. 03 takes the
  control-plane half 09 had been specifying from outside, and 05 takes
  the host row (version, channel, pin, last outcome). 09's swap is a
  four-state transition table rather than a paragraph, and says what
  `selfcheck` is allowed to do — not dial the control plane, not take the
  lock. F26 keeps its rootfs-image half (deferred with the VM slice) and
  gains F26a: first install is trust-on-first-use, so F26 begins at the
  first self-update, not at install. The link is a **port**, not a
  bounded context.
- 2026-09-19: the **shared vocabulary lands in `packages/shared`**, and two of
  these notes moved to match it. 01's open question 1 is **decided**: Zod is the
  source of truth for the wire and JSON Schema is emitted from it at build, with
  the Go structs generated from the committed artifact — one source, two
  languages. 01's "what rides the link" gains three messages the note had
  implied without naming: `events.append` with an `events.ack` that acknowledges
  **by idempotency key** (a WebSocket cannot tell "persisted" from "never
  arrived", so a batch is kept until every key is accounted for and resent
  otherwise), `attachment.credit` for the consumed-byte credit the flow-control
  section already required, and `credentials.grant` as the answer to
  `credentials.token` rather than an optional field on the ask. The hint
  vocabulary splits by socket: the link keeps three kinds and the attach ticket
  adds `host_offline`, which a connected runner could not coherently send about
  itself. 03's "repositories (cached from GitHub)" becomes **not a table** —
  listed live through the installation, remembered only by the checkout that
  took it. In the scope catalog there is no `Repository` CASL subject for the
  same reason, and no `attach` action: opening a terminal is `update Session`,
  so the model stays CRUD plus `manage`.
- 2026-09-19: the **`github/` module is built** and 03 gains the section that
  says so: six routes, one `github_installation` table, no repository table,
  and `RepositoryAccessPort` as the only thing the module exports. Two
  decisions tightened while writing it. A claim is what a workspace **holds**,
  not what it once touched: `githubInstallationId` is unique among live rows
  only, so a disconnected installation keeps its history and frees the number,
  and `GITHUB_003` means "another workspace holds this" rather than "somebody
  once connected it". And the minted repository token is **never cached** —
  GitHub gives it an hour and the runner holds it for that hour, so minting
  live is what makes "a repository removed from the installation stops working
  on the next mint" true rather than true-after-a-TTL. `github_app` is on the
  client capability subset, because a console cannot otherwise tell "you have
  not connected yet" from "this deployment has no App".
- 2026-09-19: **a project is the body of work a session belongs to**, and the
  layout gains a level. 03's data model lists `projects` and says a session
  belongs to one; 11's §1 is superseded at the top by
  `workspaces/<organization.slug>/projects/<project.slug>/{repos,sessions}`,
  because a session may check out several repositories and the old tree had
  nowhere to put the second one. 11's collision rule is unchanged and now names
  the project's directory: the repository's own name, or `<owner>--<repo>` when
  another repository already holds it, then `<owner>--<repo>-<githubRepoId>`,
  which is where a rejected random suffix used to be — every candidate is
  derived from the repository, so a directory can always be read back to what
  created it. A project is created by the first session that needs one, found
  again by GitHub's repository id (unique per workspace, and the conflict target
  of the create), and its slug is immutable because it is a directory name on
  every host holding it.
- 2026-09-19: the **`sessions/` module is built**, and with it the shape the
  whole control plane turns on: a session holds checkouts, and its append-only
  log is the truth while the row is a fold of that log. 03 gains the section
  that says so — three tables, eleven routes, and the two ports the relay will
  bind. Four decisions were sharpened while writing it. **The stored lifecycle
  answers "is this work finished", not "is a process running"**, so stopping a
  session leaves it `open` with a `stoppedAt` and `resolved` is terminal — a
  late `session.started` from a runner that has not heard about the close cannot
  bring a session back. **A restart records a request, not an outcome**: the
  control plane must not claim `open` before a host has built anything, whereas
  a stop *is* the decision and is recorded as the fact it is. **The name is part
  of the fold**, so "a model-derived title never overwrites a name a person
  typed" is a rule a replay goes through rather than a check somebody has to
  remember. And **`seq` is allocated in a second statement after the row lock**,
  because under READ COMMITTED a statement's snapshot is taken before it blocks,
  so reading the maximum in the same statement as the `FOR UPDATE` hands every
  waiter the same numbers — the concurrency test is what found it. 11's §1 note
  gains the two names below the project (the session's minted slug and the
  checkout's directory) and the rule that neither is ever reissued.
- 2026-09-19: **archiving a project ships with the sessions slice**, and it
  fails closed. "Is any session still open in this project" is a question only
  the module that owns sessions can answer, so `DELETE /projects/{id}` asks it
  over the query bus and refuses with `PROJECTS_003` when nothing answers —
  assuming "no sessions" on a destructive path is the fail-open this shape
  exists to rule out. Archiving is also a tombstone on the create path: a
  session cannot be started in a retired project, including the first session of
  a repository whose project was archived, because the origin is unique per
  workspace and reopening it would put new work inside a retired directory.
- 2026-09-19: **naming a session is configuration, and the default is to name
  nothing.** `SESSION_NAMER_PROVIDER`, `SESSION_NAMER_MODEL` and
  `ANTHROPIC_API_KEY` choose the namer behind a port; with none set every
  session keeps its minted slug, which reads fine and costs nothing. It is a
  deployment capability rather than a silent default so that "why is nothing
  here ever named" is answered by the startup log. The one line that leaves the
  host is the person's own first prompt — the agent transcript it was read from
  does not — which is a sentence the privacy note owes.
- 2026-09-19: the runner's two ordinary HTTPS calls carry the API's
  `/api/v1` prefix — `POST /api/v1/hosts/register` and `DELETE
  /api/v1/hosts/self` — and uninstall no longer puts a host id in the
  path: the host names itself by the subject of the boot JWT it presents.
  That JWT stays an `Authorization: Bearer` credential, which the control
  plane's resolver recognises as a host principal next to session cookies
  and personal access tokens, rather than a header of its own that would
  be frozen into every installed runner. **Key rotation leaves the
  runner** until the link can carry it: the register route redeems
  registration tokens and cannot rotate a key, and 09 §3 already places
  rotation on an authenticated link. Recorded in 01, 03 and
  `apps/runner`'s pairing client.
- 2026-09-19: **a host belongs to a person, and workspaces borrow it.**
  08 said a host row carries the workspace id; it now carries
  `ownerUserId` and no workspace id, the way Better Auth hangs `session`
  and `account` off `user`. The case that decides it is one person with a
  personal and a company workspace on one laptop: per-workspace, that
  machine is paired twice, runs two runners with two keys, and the second
  install has to invent a second `~/oppenheimer-ai`; per-person it is
  paired once and either workspace runs sessions on it. It is also the
  honest reading of the machine: a session there has full access to it
  (F10), runs under its owner's Unix account, and spends the agent login
  in that person's home directory. The tenant boundary does not
  disappear, it moves down: a session carries the workspace, and the host
  it names must be one its creator owns or holds a grant on. 08's open
  question 2 is **decided** with it — the pairing token is bound to the
  user who minted it, and the host it creates is theirs. Recorded in 08,
  03, 09 and `apps/api/src/hosts/`. A host's key is a **column on the host
  row** rather than a `host_keys` table, and the retired key joins it as a
  second column when rotation arrives on the link: rotation needs exactly
  two keys, never N, and every runner boot reads them.
