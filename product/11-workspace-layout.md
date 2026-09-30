# 11 — Workspace layout: one place per project, bare stores plus worktrees

Decision from discussion: no free-form filesystem freedom. Every project
lives in one fixed place, every repository it uses has one bare store there,
and every session is a directory of worktrees beside them — Orca's worktree
model, with a project level above it because a session may check out several
repositories.

This note owns the tree and the on-disk lifetime.
`product/versions/mvp/03-control-plane.md` owns the tables the names come from.

## 1. The layout

```
~/oppenheimer-ai/
│
├── workspaces/
│   └── jordi/                             ← organization.slug
│       └── projects/
│           └── xrp-mobile/                ← project.slug
│               │
│               ├── repos/                 ← bare stores. Nobody works here.
│               │   ├── acme--xrp-mobile.git/
│               │   └── acme--design-system.git/
│               │
│               └── sessions/
│                   ├── bold-otter-3f9a7k/     ← work_session.slug
│                   │   ├── .oppenheimer       ← provenance marker
│                   │   ├── xrp-mobile/        ← checkout, the agent's cwd
│                   │   └── design-system/     ← second checkout, a sibling
│                   └── quiet-heron-b210c4/
│                       └── xrp-mobile/
│
└── accounts/                              ← per-provider config dirs (note 06)
```

A **project** sits above the repository because a session may check out several,
and a workspace sits above the project because the host belongs to the person:
one machine serves every workspace its owner is in, and `project.slug` is unique
only per workspace.

`repos/` and `sessions/` are peers, never nested — a worktree inside its own
repository means `git status` sees it and file watchers recurse into it — and the
store is **bare**, so "never edited" is structurally true rather than a rule in a
document. `git worktree add` works from a bare repo; one gotcha is that
`git clone --bare` sets no fetch refspec, so the runner adds
`+refs/heads/*:refs/remotes/origin/*` or `git fetch` never updates
remote-tracking refs.

### Every name here is a column, and none is derived from a path

| Level | Name | Where it comes from |
|---|---|---|
| `workspaces/<slug>` | `organization.slug` | already unique, and the console exposes no way to change it |
| `projects/<slug>` | `project.slug` | the repository that created the project: `<repo>`, or `<owner>--<repo>` when another repository already holds that name, then `<owner>--<repo>-<githubRepoId>` |
| `repos/<name>.git` | reported by the runner | it names the store `<owner>--<repo>.git`, writes the GitHub id into the bare repo (`git config oppenheimer.repo-id`) and thereafter finds it **by id**; the name is recorded on the checkout as a fact, because a worktree's `.git` file points at its store by absolute path and `fullName` moves on every GitHub rename |
| `sessions/<slug>` | `work_session.slug` | minted at create as `<adjective>-<noun>-<6 base36>`, because the directory and the branch exist before anything has been typed |
| `sessions/<slug>/<dir>` | `session_checkout.directoryName` | the same three candidates as the project, picked against every name this session has **ever** used |

Paths are then fully derived, every segment a unique-constrained column:

```
store     workspaces/{organization.slug}/projects/{project.slug}/repos/{session_checkout.storeDirectoryName}
checkout  workspaces/{organization.slug}/projects/{project.slug}/sessions/{work_session.slug}/{session_checkout.directoryName}
branch    oppenheimer/{project.slug}/{work_session.slug}
```

Identity is the UUID and the path is a derived attribute, never the other way
round. The branch is always the session's own, created from each checkout's base
branch and never the base itself: both segments are unique-constrained, so a
branch name is collision-free by construction, and git refuses a worktree on a
branch another worktree already holds — so two sessions "on `main`" would fail at
the second.

### What lives on disk, and for how long

**A name is never reissued.** Claude Code and Codex key their conversation state
by working directory, so a new session or checkout landing on a retired name
inherits a stranger's history — a bug that is near-impossible to diagnose from
the symptom and free to rule out. `uq (projectId, slug)` and
`uq (sessionId, directoryName)` are the permanent tombstones that rule it out,
which is why **no row is ever hard-deleted**: closing a session moves its state
to `resolved`, retiring a checkout sets `removedAt`, archiving a project sets
`archivedAt`, and all three rows stay.

**The runner removes a worktree only when the control plane says the session is
closed, and only when it carries `.oppenheimer`.** Stopping a session ends the
agent and the tmux session and leaves every checkout exactly where it is, so a
restart recreates window 0 in the same worktrees after a host reboot. Closing is
what removes them: push each checkout's branch, then `git worktree remove` and a
prune — and it **refuses when a checkout has unpushed work** unless the caller
accepted the loss, never passes `--force`, and relays git's own refusal verbatim.
Because only the host can do that work, closing is a *request* the control plane
records and `session.closed` is what comes back
(`product/versions/mvp/03-control-plane.md`).

Ownership is proven by that marker rather than by where a directory sits: a person
can run `git worktree add` by hand under `~/oppenheimer-ai/`, and path shape alone
is not authority. A session directory the control plane does not know about is
**reported, never reaped**.

## 2. What this changes: Keep sessions share a workspace VM

Note 07 said "a VM per session". With a worktree model that becomes:

| Lifetime | Where it runs | Isolation |
|----------|---------------|-----------|
| **Keep** | a **workspace VM per project per host**, long-lived, holding that project's bare stores and all its sessions. Each Keep session is a directory of worktrees plus a tmux session inside that VM. | between projects: the VM. Between sessions of the same project: processes and directories, as in Orca. |
| **Ephemeral** | its own disposable VM, with the same layout but a single worktree. | the VM. |

*v0.2 does not build the shared workspace VM* (note 15 §2): a session
is its own microVM, Keep or Ephemeral, the way Claude Code on the web
runs one, and this section stays as the design to reach for if the
per-session clone ever hurts.

Why this is better for Keep:

- It is the Orca experience: worktrees side by side, instant to create,
  one machine per project.
- Ten sessions on one repo need one clone, one dependency install, one
  Docker daemon, one warm cache, not ten.
- The sleep tiers apply to the workspace VM as a whole: it sleeps when
  every session in it is idle, which is what you want, and wakes when
  any of them is opened.
- The VM cap counts workspace VMs, not sessions, so the i7 host's four
  running VMs can hold dozens of active sessions across four repos.

What it costs: two agents in the same repo VM can see each other's
worktrees. For a personal workspace that is fine and matches Orca. The
day sharing or multi-tenancy arrives, Ephemeral or a per-user workspace
VM is the boundary, unchanged.

## 3. Create session, revisited

The chips stay: host, repo, branch, agent, lifetime. What they do:

1. **host + repo** pick (or boot) the workspace VM for that project on that
   host. First time: boot, create the bare store under `repos/`, run the
   repository's setup script once, cached for the VM's life.
2. **branch** is the base: each worktree is created from the store at
   `origin/<branch>`, on the session's own branch.
   Starting from an existing feature branch checks out that branch in
   the worktree instead.
3. **agent** is launched in the worktree with the account's config dir.
4. **lifetime** Keep uses the workspace VM; Ephemeral boots its own.

Dependency installs run per worktree the first time it is used, with
the package manager's cache shared through the VM, so the second
worktree is fast.

## 4. What stays fixed

No custom paths and no cloning elsewhere. The terminal is a real shell and
the agent can `cd` anywhere on the machine, but the platform only creates,
lists and removes things under `~/oppenheimer-ai/workspaces`, it only removes
what carries `.oppenheimer`, and the sidebar only knows sessions and their
checkouts. If someone wants a different layout they are using the wrong
product, which is the point.

## 5. Three runtimes, one layout

Two wishes from discussion pull in different directions. One is the
Claude Code on the web feeling: a VM that is mine, where the agent
installs Docker and Postgres and runs the app cleanly with nothing else
on the box. The other is a Mac Studio with Xcode simulators and Android
emulators, where an agent runs QA on a mobile app or auto-fixes a bug
it sees on screen. A shared workspace VM per repo gives neither.

So the **host chip** carries a runtime, and the layout is the same in
all three:

| Runtime | What it is | Isolation | When |
|---------|------------|-----------|------|
| **Shared workspace** | the per-repo workspace VM from §2, one worktree per session | between repos | quick tasks, several agents on one repo, Orca feel |
| **Clean VM** | a VM for this session alone, same layout, one worktree, Docker inside, nothing else running — in v0.2 a Firecracker microVM that exists only while the session is active, on a kept disk (note 15) | full | anything that starts services: Postgres, Redis, the app on a port, integration tests. The Claude Code on the web feeling. Keep or Ephemeral. The default on a host with KVM. |
| **This machine** | the runner in direct mode (note 02 mode A) on a machine you own, same layout under your home, no VM | none, it is your machine | the Mac Studio: Xcode simulators, Android emulators, real devices over USB, screenshots and taps for QA. Anything that needs a GUI or hardware. |

Port and service clashes decide the first two: a session that needs
`:5432` or `:3000` belongs in a Clean VM. In a Shared workspace, the
runner still keeps worktrees from fighting by giving each a
`COMPOSE_PROJECT_NAME` and a port offset, but the honest default for
"run the app" is Clean VM.

### The Mac Studio case

- The runner runs as you on the Mac (launchd), so `xcrun simctl`,
  the Android emulator, `adb`, and screen capture all work, because
  they are the same tools you would use in Terminal.
- Sessions are worktrees under `~/oppenheimer-ai/workspaces` exactly as
  in a VM. Sleep tiers do not apply; the Mac is always on. State dots,
  tabs, accounts, and the login button all work unchanged.
- An agent doing QA needs eyes: screenshots from the simulator into its
  context and taps back. That is agent-side tooling (an MCP server for
  simctl and adb, or the agent's own computer-use), not platform work.
  The platform's job is to put the agent on the machine that has the
  simulator, which is this runtime.
- Simulators inside a Linux VM are the wrong path: Xcode does not run
  there at all, and the Android emulator needs nested virtualization,
  which the runner host disables on purpose.

### What this changes

Mode A, direct machine, comes back into the plan as the third runtime
and is the second slice after the MVP, because the runner already has
everything it needs for it except the macOS install path. The MVP ships
Shared workspace and Clean VM on the Linux host.
