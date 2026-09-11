# 11 — Workspace layout: one place per repo, main plus worktrees

Decision from discussion: no free-form filesystem freedom. Every repo
lives in one fixed place with one main checkout and one worktree per
session, exactly like Orca's worktree model, so the UX is the same.

## 1. The layout

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
