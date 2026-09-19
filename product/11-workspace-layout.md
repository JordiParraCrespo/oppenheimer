# 11 — Workspace layout: one place per repo, main plus worktrees

Decision from discussion: no free-form filesystem freedom. Every repo
lives in one fixed place with one main checkout and one worktree per
session, exactly like Orca's worktree model, so the UX is the same.

## 1. The layout

> **Superseded (2026-09-19).** A session may check out several repositories, so
> a **project** level sits above the repository and the tree is
> `~/oppenheimer-ai/workspaces/<organization.slug>/projects/<project.slug>/`,
> holding `repos/<owner>--<repo>.git` (bare stores, nobody works there) beside
> `sessions/<session.slug>/<checkout>/` (the worktrees). The collision rule
> below is unchanged and now names the **project's** directory: the repository's
> own name, or `<owner>--<repo>` when another repository already holds it.
> `project.slug` is that directory name, it is immutable, and an archived
> project keeps its row so the name is never reissued. The original layout is
> kept below as the decision it came from.
>
> **The two names below the project are columns too (2026-09-19).** A session's
> directory is `work_session.slug`, minted as `<adjective>-<noun>-<6 base36>`
> before anything has been typed, because the directory and the branch have to
> exist first. A checkout's directory is `session_checkout.directoryName`: the
> repository's own name, then `<owner>--<repo>`, then
> `<owner>--<repo>-<githubRepoId>` — the same deterministic candidates the
> project uses, picked against every name **this session has ever used**, retired
> ones included. And the branch is always the session's own,
> `oppenheimer/<project.slug>/<work_session.slug>`, created from each checkout's
> base branch and never the base itself: both segments are unique-constrained, so
> a branch name is self-identifying and collision-free by construction, and git
> refuses a worktree on a branch another worktree already holds.
>
> **Neither name is ever reissued.** `uq (projectId, slug)` and
> `uq (sessionId, directoryName)` are permanent tombstones, because Claude Code
> and Codex key their conversation state by working directory: a new session or
> checkout landing on a retired name would inherit a stranger's history, which is
> near-impossible to diagnose from the symptom and free to rule out. So nothing
> is hard-deleted — closing a session sets its state to `resolved` and retiring a
> checkout sets `removedAt`; both rows stay.

```
~/oppenheimer-ai/
  workspaces/
    <repo-name>/
      main/                 the main checkout, always on the default branch, never edited directly
      worktrees/
        <session-slug>/     one git worktree per session, on that session's branch
        <session-slug>/
    <another-repo>/
      main/
      worktrees/
  accounts/                 per-provider config dirs, mounted from the account volumes
```

- `main/` is the fetch source and the base for every worktree. The
  runner keeps it up to date (`git fetch` on session create, fast-forward
  of the default branch). Nobody works in it.
- `worktrees/<session-slug>/` is created with `git worktree add` from
  `main/`, on a branch named after the session. That takes under a
  second and shares the object store, so ten sessions on one repo cost
  one clone plus ten working trees.
- The session's terminal opens in its worktree. The status line shows
  `repo · worktree · branch`. Nothing else is offered.
- Closing a session removes its worktree (`git worktree remove`) after
  the branch is pushed. `main/` stays.

Repo name is the GitHub repository name; if two installations expose
the same name, the second gets `<owner>--<repo>`.

## 2. What this changes: Keep sessions share a workspace VM

Note 07 said "a VM per session". With a worktree model that becomes:

| Lifetime | Where it runs | Isolation |
|----------|---------------|-----------|
| **Keep** | a **workspace VM per repo per host**, long-lived, holding that repo's `main/` and all its worktrees. Each Keep session is a worktree plus a tmux session inside that VM. | between repos: the VM. Between sessions of the same repo: processes and directories, as in Orca. |
| **Ephemeral** | its own disposable VM, with the same layout but a single worktree. | the VM. |

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

1. **host + repo** pick (or boot) the workspace VM for that repo on that
   host. First time: boot, clone into `main/`, run the repo's setup
   script once, cached for the VM's life.
2. **branch** is the base: the worktree is created from
   `main/` at `origin/<branch>`, on a new branch `<session-slug>`.
   Starting from an existing feature branch checks out that branch in
   the worktree instead.
3. **agent** is launched in the worktree with the account's config dir.
4. **lifetime** Keep uses the workspace VM; Ephemeral boots its own.

Dependency installs run per worktree the first time it is used, with
the package manager's cache shared through the VM, so the second
worktree is fast.

## 4. What stays fixed

No custom paths, no cloning elsewhere, no editing `main/`. The terminal
is a real shell and the agent can `cd` anywhere inside the VM, but the
platform only creates, lists, and removes things under
`~/oppenheimer-ai/workspaces`, and the sidebar only knows worktrees. If
someone wants a different layout they are using the wrong product,
which is the point.

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
| **Clean VM** | a VM for this session alone, same layout, one worktree, Docker inside, nothing else running | full | anything that starts services: Postgres, Redis, the app on a port, integration tests. The Claude Code on the web feeling. Keep or Ephemeral. |
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
