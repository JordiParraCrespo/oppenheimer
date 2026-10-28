# 24 — Where a session runs, and the layout on a host

The 2026-10-14 export (`design/version1/SessionsConsole (where).dc.html`,
`Settings (where).dc.html`) makes **where a session runs** a choice. Until
now every session was a git worktree, the blank terminal included (00, 02
§5, 10). This note says what each choice is, how the runner lays out what
it owns on a host, and what the protocol, the API and the console carry.
The owner settled the questions in conversation on 2026-10-11 to
2026-10-14; they are under "Decided" at the end, and the sections are
written to match.

This is not production: hosts made before this note are not migrated. A
runner on this note's layout ignores sessions it made under the old one.

## 1. Two places, one per kind of file

| Place | What it holds | Who chooses it |
|-------|---------------|----------------|
| `~/.oppenheimer/` | The runner's home: identity, keys, state, logs, binaries, attachments. Hidden, `0700`, never somewhere an agent works | Fixed (`RUNNER_HOME` for development) |
| The **work folder**, `~/oppenheimer/` by default | Everything an agent works in: stores, sessions, agent homes | The person, at install (`--workspaces`), saved in `config.json` |

Secrets never sit in the work folder, and deleting or reinstalling the
runner never touches it. This is Orca's split too (its app state under
the OS's application-support directory, its worktrees under
`~/orca/workspaces`).

## 2. The work folder

```
~/oppenheimer/                                   the work folder
├── layout.json                                  {"version": 3}
└── <account-id>/                                one Oppenheimer account (a pairing)
    ├── .oppenheimer/meta.json                   {"kind":"account", …}
    └── <workspace-id>/                          one workspace (organization) of that account
        ├── .oppenheimer/meta.json               {"kind":"workspace", "slug": …}
        ├── repos.noindex/                       stores: a cache of GitHub, safe to rebuild
        │   ├── <owner>--<repo>.git/             bare, found by GitHub id (oppenheimer.repo-id)
        │   └── .spares/<owner>--<repo>/         the pre-built worktree that makes a create instant
        ├── agents/<agent-id>/                   reserved (bots moved into Oppenheimer: 25-bots.md)
        └── sessions.noindex/<slug>/             a worktree session
            ├── .oppenheimer/meta.json           {"kind":"session", "id": …, "origin": …}
            └── <repo>/                          a checkout: the agent's working directory
```

- **The directories that hold checkouts end in `.noindex`**, the suffix
  Spotlight skips with everything below it. A session is a whole
  checkout, dependencies included, rewritten whenever an agent installs
  something; indexed, `mdworker_shared` takes more CPU than the agents on
  a Mac host. `.metadata_never_index` at the root does not keep Spotlight
  out (MVP decision log, 2026-10-01); the runner still writes it.
- **Every level is named by an id that never changes**, never by a name
  someone can edit. A path never changes after it is made, because the
  agents key their own history on the working directory (Claude Code's
  `--resume` reads `~/.claude/projects/<encoded cwd>/`).
- **The account level** is the pairing: a runner paired with one
  Oppenheimer account writes under that account's folder. Several
  accounts on one machine are several runners, each with its own home
  and its own account folder in the same work folder. The folder is
  named by the account id the runner receives at pairing:
  `POST /hosts/register` answers it beside the host id, the runner keeps
  it in its identity, and no later command repeats it. An identity paired
  before that answer existed names the level by its host id.
- **There is no project level.** A project is metadata (10); a session's
  folder never moves when it moves to another project.
- **`.oppenheimer/` is the one hidden name** a managed folder carries, a
  folder rather than the old marker file: `meta.json` says what the
  folder is and who made it, so a runner can tell its own folders from
  anything else, and only a folder that carries it is ever deleted.
- **Stores are bare**, and live beside the sessions rather than holding
  them, so `git status` in a store sees no worktree and no IDE walks into
  one.

## 3. Three ways to start a session

| Where | What the runner does | Its working directory | Closing it |
|-------|---------------------|----------------------|------------|
| **New worktree** | Clones or fetches the stores, cuts `oppenheimer/<slug>` from each base, adds a worktree per repository under `sessions.noindex/<slug>/` | The checkout the control plane names | Removes the worktrees (after the branch is pushed, as today) and the session folder |
| **Folder on host** | Nothing on disk: no clone, no branch, no marker | The folder the person picked, which must exist and be a directory | Ends the tmux session; nothing on disk is touched |
| **Blank terminal** | The `shell` agent, in either of the above | As above | As above |

A folder session's folder is the person's. The runner never writes into
it and never deletes it; the agent works there as the person would, on
whatever branch the folder is on, with the person's own git
credentials. **Open terminal** on a host (Settings) is a folder session in
`~` with the `shell` agent.

A folder session has no checkouts, no branch of ours, no pull request
flow and nothing to push before it closes.

## 4. Picking a folder

The folder picker lists a host's directories through the runner:
folder names only (no files, no file contents), the git branch of a
folder that is a repository, starting at the home directory. The API asks
the runner and answers the console; nothing is cached. Recent folders
are the folders of the person's earlier folder sessions on that host,
newest first, read from the API's own rows.

A path that does not exist, or is not a directory, cannot be used: the
picker's Use is off, and the runner refuses the create if the folder went
away in between.

## 5. What carries it

- **Protocol.** `session.create` carries the place: checkouts for a
  worktree session, an absolute `folder` path for a folder session (never
  both), and the workspace id; the account is not on the frame, it is
  the pairing's (§2). `repository.prepare` carries the workspace the
  same way. `fs.list` lists a directory. A runner says it understands both
  in its `hello` capabilities; the API sends neither to a runner that does
  not.
- **API.** `work_session` records the place (`worktree` | `folder`) and,
  for a folder session, the path. A folder session's create carries no
  checkouts. `GET /hosts/{id}/folders?path=` lists a directory through
  the host's link, and the recent folders come back with it.
- **Console.** New session's first chip is **Where**: New worktree
  (Project, Host, Repository, Branch) or Folder on host (Host, Folder,
  Project, optional, Unassigned by default). The agent picker's **Blank
  terminal** hides the permission chip. A folder session's row carries a
  folder icon, a terminal session's a terminal icon.

## 6. The permission level

New session opens on `auto` the first time and on the last level picked
after that, as the other chips do (05, changed 2026-10-14).

## 7. Claude Code cloud, the third place

Added 2026-10-27 (`../../research/cloud-agents.md` §5B,
`../../next-steps/cloud-agents.md`). A `cloud` session is started from a
host and then lives on claude.ai/code:

- **What the runner does.** It fetches the one checkout's store with a
  token minted for that repository and sealed into `session.create`'s
  `cloud` field, checks the base out detached in a scratch directory,
  runs `claude --cloud <task>` there under a pseudo-terminal, and removes
  the directory. Nothing is made in the work folder; no tmux session, so
  no poll ever reports it stopped. It names `session.cloud` in its hello.
- **What the API keeps.** `place = 'cloud'` and the cloud session's id in
  `agentSessionId` (from `session.started`); a hello never records a cloud
  session stopped. Its state is `agent.observed`, posted by the browser
  extension (`POST /sessions/cloud-status`).
- **What the console shows.** Where: *Claude Code cloud* on a host, with a
  repository and a task (Claude Code only, no files). The row's mark is a
  cloud. The pane has no terminal: the state, *Open in claude.ai*, and
  `claude --teleport <id>`.
- **Deleting it.** Nothing of it is on the host, so the API records the
  close whole — the request and `session.closed` — without the host, online
  or not, and the session leaves the console at once. It stays on
  claude.ai/code, where it is archived. Its input (a prompt, an answer, a
  file) is refused with `SESSIONS_038`: it is answered on claude.ai.

## Decided

- 2026-10-14: two places: the runner's home `~/.oppenheimer/`, and a work
  folder the person chooses, `~/oppenheimer/` by default.
- 2026-10-14: the work folder is `<account>/<workspace>/{repos, agents,
  sessions}`, every level named by an id; no project level. Since
  2026-10-28 `repos.noindex` and `sessions.noindex`, so Spotlight skips
  them (layout version 3, no migration).
- 2026-10-14: a session is a new worktree or a folder on the host; the
  blank terminal is an agent, not a place. A folder session's folder is
  the person's: never written, never deleted.
- 2026-10-14: projects may hold no repository (10); a project without any
  holds folder sessions only. The project nobody names stays
  **Unassigned**.
- 2026-10-14: the permission level opens on `auto` and is remembered.
- 2026-10-14: not production, so no migration: a runner on this layout
  ignores the old one.
- 2026-10-14: the account folder is named by the account id the runner
  receives at pairing (`POST /hosts/register`), not by a field on every
  command: the frames carry the workspace only.
- 2026-10-27: a third place, `cloud`: Claude Code's cloud, started by the
  host's runner with `claude --cloud` and followed through the browser
  extension (§7).
- 2026-10-28: the `cloud` place has a second kind, a session the control
  plane launches at a vendor through its API (Cursor's first): no host at
  all, its vendor run beside it in `session_cloud_run`, its row opening the
  vendor (`next-steps/cloud-agents.md`, "Two kinds of cloud session").
