# MVP design

In-depth design of the MVP defined in [`../../07-mvp.md`](../../07-mvp.md).
One document per area, in the order they unblock each other. Each
document opens with what is already decided in the research notes,
then the questions still open. Decisions made here are final for the
MVP; when one changes, update the document and add a line to the log
at the bottom of this file.

| # | Document | Covers |
|---|----------|--------|
| 00 | [Scope](00-scope.md) | The exact feature list, in and out, and the demo scene it must satisfy |
| 01 | [Protocol](01-protocol.md) | Messages between browser, control plane, and runner; PTY frames; tickets; events |
| 02 | [Runner](02-runner.md) | The Go binary: sessions, tmux, ring buffer, reconnect, screen manifests, libvirt, vsock, sleep, account volumes |
| 03 | [Control plane](03-control-plane.md) | Data model, API, relay, GitHub App, token minting, sleep scheduler |
| 04 | [Guest image](04-guest-image.md) | Deferred with the VM slice; kept for later |
| 05 | [Screens](05-screens.md) | Sign-in, sidebar, Create session, session view, settings drawer; components and states |
| 06 | [Step-one spike](06-step-one-spike.md) | Exactly what to build in week one and how the latency gate is measured |
| 07 | [Security checklist](07-security-checklist.md) | The findings from note 04 that the MVP must satisfy, as a checklist |
| 08 | [Auth](08-auth.md) | Identity, the personal workspace, host ownership, session attach; one page instead of the starter's kernel design |
| 09 | [API modules and data model](09-api-modules-and-data-model.md) | The in-depth version of 03's data model: the four API modules, their aggregates, the nine new tables, the endpoint surface, and where agents and models live |

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
- 2026-09-18: 09-api-modules-and-data-model.md added, deepening 03's
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
  `SessionState` gains `blocked` and `stopping`.
