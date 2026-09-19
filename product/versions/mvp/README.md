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
| 10 | [API modules and data model](10-api-modules-and-data-model.md) | The in-depth version of 03's data model: the five API modules, their aggregates, the eight new tables, the on-disk layout, the endpoint surface, and where agents and models live |

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
- 2026-09-18: 10-api-modules-and-data-model.md added, deepening 03's
  "Data model, first cut" into the module map and schema the enforced
  `apps/api` contract can carry. Four modules, not seven: `identity` is
  the starter's auth, `installations` and `repositories` merge into
  `github/` (one aggregate, because a webhook replaces the repository
  set as a whole), `tokens` is a port on `github/` rather than a module
  because installation tokens are never stored, and `events` is a table
  inside `sessions/` rather than a module of its own. **Models and
  coding agents get no table**: a model picker is a stated MVP non-goal
  and an agent needs runner code either way, so the agent catalog is a
  closed list in `packages/shared` and per-host availability is a host
  fact. **"Repositories" and "GitHub allowed repositories" are one
  noun**, because the App installation is a boundary GitHub enforces.
  `SessionState` gains `blocked`, the one wire change; `done` and
  `unknown` from the screen manifest are still unmapped (10 open Q8).
  The schema is held to the shape of the starter's own Better Auth
  tables — flat rows, credentials inline with their subject, a table
  only where the lifetime is genuinely independent. That deletes three
  tables an earlier draft had: host keys become a column pair on `host`,
  the attach ticket becomes a Redis key with a TTL, and webhook
  de-duplication becomes a cache key because the handler is a full
  resync and therefore already idempotent.
- 2026-09-18: **a project level, and a session that holds several
  checkouts.** A project is the body of work; a session is one piece of
  work inside it; a checkout is one repository on its own branch, and a
  session has one or more. So `work_session` loses `repositoryId`,
  `baseBranch` and `branch` to a new `session_checkout` table, and gains
  `projectId` and `cwdCheckoutId` — *where the agent is launched*, the
  one fact that matters, encoded directly instead of as a flag on a
  checkout row. Eight tables, five modules (`projects/` joins). The
  layout becomes
  `projects/<slug>/repos/<owner>--<repo>.git` (bare, always
  owner-prefixed) plus `projects/<slug>/sessions/<slug>/<checkout>`,
  superseding note 11 §1; `projects/` rather than `workspaces/` because
  the latter already means the `organization` row. A checkout records
  whether it is a `worktree` or a `clone`, because cleanup differs.
  Four rules come from reading Orca's source: identity is never a path,
  ownership is proven by a `.oppenheimer` marker and never by where a
  directory sits, ownership and visibility are different axes, and a
  session slug is never reused because agent CLIs key conversation
  state by working directory — which means `work_session` rows are
  never hard-deleted. The pairing token gains `intendedName` so a host
  can be named before it exists, as Orca's Add-remote-server dialog
  does.
- 2026-09-18: **a host has an owner, not just a workspace.** 08-auth.md
  said hosts belong to the workspace that paired them. That is right
  about the tenant boundary and wrong as a default for use: a session on
  a direct-mode host has full access to the machine (F10), runs under
  its owner's Unix account, and spends the agent login that is "the
  host's own" — so workspace-ownership would make handing a teammate
  your laptop and your subscription the default. `host.ownerUserId` is
  therefore not audit only, and `HostResource` declares `'own'` and
  `'grant'` as `leads` does. Identical in the MVP, where one person is
  the whole workspace; the teams slice inherits the safe default.
- 2026-09-19: **lessons from `eliasstravik/herdr-projects`**, which runs
  the same shape (a project of threads, each a worktree and a branch).
  It keeps **three** state vocabularies where this note kept one, which
  is why `done` and `unknown` had nowhere to go: a stored lifecycle, the
  agent's own pane observation, and a group derived on read and
  organised by *what needs you*. `done` and `unknown` are inputs, not
  session states. The group adds `landing` — pushed, PR open and
  approved, not merged — which nothing here had named, and makes
  `ready-for-review` a hash comparison rather than a state. Two rules
  come with it: debounce from a recorded transition, never a live probe,
  so a caller with no history cannot fabricate "blocked for five
  minutes"; and precedence order is a different function from display
  order. **Branch names now carry the ids** —
  `oppenheimer/<project>/<session>` — which makes the cross-session
  branch collision three reviewers flagged impossible by construction
  rather than checked. A session may have **zero** checkouts, for a
  project of notes and bots. `project` rows are never hard-deleted, so
  the slug is a tombstone: herdr frees its project slugs on delete while
  path-keyed grants survive, and warns about it in its own code. `stop`
  leaves the worktrees on disk and `DELETE` closes, refusing when work
  is unpushed and relaying git's refusal verbatim. No open questions
  remain in 10.
- 2026-09-19: **a host belongs to a person; workspaces borrow it.**
  Reverses the 2026-09-18 line above: `host` loses `organizationId`
  and keeps `ownerUserId`, scoped own-or-grant, because Better Auth
  hangs every device-and-login table off `user`, and because the case
  that matters — one person, a personal and a company workspace, one
  laptop — pairs the machine once. The Claude login on that machine is
  the person's too, so host and login sit on one axis; several logins
  per machine are the accounts slice (note 06, `CLAUDE_CONFIG_DIR`, as
  Orca and OpenClaw do it), not the MVP. The layout gains
  `workspaces/<organization.slug>/` above `projects/`. Three more
  decisions: **one API replica** for now (`connectionEpoch` and
  `connectedReplicaId` gone; the fence is a named slice in `relay/`);
  **sessions are named from the first prompt** by `claude-haiku-4-5`
  behind a port, with an opaque minted slug (`bold-otter-3f9a7k`) as
  directory, branch and fallback name; **each checkout picks a base
  branch** and the working branch is always
  `oppenheimer/<project>/<session>`. The review's eleven act-on
  findings are folded into 10: composite `(organizationId, …)` keys,
  `removedAt` on repositories and checkouts, a frozen
  `storeDirectoryName`, `Idempotency-Key` on create, `<runId>:<n>`
  runner keys, the redeem-and-insert transaction with a fingerprint
  retry, gateways in `relay/infrastructure/` that guard themselves in
  the handshake, and three GitHub webhooks instead of one.
