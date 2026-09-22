# 05 — Screens

## Decided

- Sign-in: GitHub, Google, or email and password. Connect GitHub (the
  App install) is its own step after sign-in.
- Onboarding, four numbered steps and a landing, shown once. Each step
  opens with a Back link, a hairline and the mono counter ("2 of 4"),
  then the display title and a lead; the right half is the photo
  carousel. (1) Sign in. (2) Name your workspace: the name, and the
  permanent address under `oppenheimer.dev/`, checked for availability
  as you type with a spinner, a green check or a red cross and a hint
  in the same tone; Continue waits for an available address. (3)
  Connect GitHub, all or selected repos, skippable but the repo chip
  stays empty until done. (4) Add a host, with two copyable blocks, the
  install command and the prompt for an AI agent, both carrying the
  same one-hour token, the screen flipping to the registered host when
  the runner registers. Then Ready: a success ring, "You're all set", a
  summary card of workspace address, code and host, and one button into
  the console, where New session has its chips prefilled (the host just
  added, the first repo of the installation, its default branch, Claude
  Code). Missing pieces are handled inline afterwards: no `claude`
  login becomes the login URL button in the terminal; no `tmux` is
  caught at the add-host step. (Replaces the earlier "four screens
  ending on New session"; decided 2026-09-19 with the version-1 frames.)
- Sidebar: sessions as a branch glyph coloured by state, name, age on
  hover; a session still provisioning joins the list at once with a
  pulsing grey glyph; New session on top; a filter menu (repository,
  agent, host, sort) with the active filters as chips under the header;
  the account menu at the bottom with appearance and language; hosts in
  a settings drawer.
- The sidebar **is** the console's navigation, and version 1 has no
  other destination: no nav rows, no chrome bar over the pane, no
  command palette, and no settings or profile page — the account menu
  holds appearance, language and log out, and nothing else. The console
  is one screen: a sidebar beside the pane a session opens in. The
  settings drawer above is a later slice, and a drawer is not a route;
  hosts are paired in onboarding until it arrives. (Decided 2026-09-21
  with the version-1 frames; the starter's Settings and Profile screens
  were deleted rather than left unnavigated.)
- New session: chips for host, repository, branch; a composer for the
  first task whose foot row reads scope of action, then engine: attach
  and the permission level on the left (ask for approval, approve for
  me, full access, the last in a warning tone because it changes a
  machine unattended); the agent and model, the effort and dictation on
  the right. The agent lives in the engine button, not a chip: opening it
  lists the harnesses, choosing one slides to its models with a search,
  and a blank terminal is picked outright. Effort is a five-stop slider
  (Minimal to Max) in a popover, not a list. Chips remember last choice. Every chip filters (a search row, an empty
  line). The repository chip multi-selects; each selected row carries
  its branch, which opens a branch pane for that repository; the branch
  chip shows only while one repository is selected. The host chip's
  foot action opens the **Add host dialog**: the same instruction in
  two forms behind a Command / Agent prompt switch, a copyable panel,
  the token line, and a status line that resolves in place from
  "Listening for this host…" to the registered host, with Use this host
  enabled then. The model list is the harness's own (a blank
  terminal has no model). Runtime
  and lifetime chips arrive with the VM slice.
- **What the foot row sets, and what it remembers.** The permission
  level is the product's own three words (`ask` / `auto` / `full`
  stored; "Ask for approval" / "Approve for me" / "Full access" on the
  control), and each agent's catalog entry says what they mean to its
  CLI. Effort is the five stops the slider draws; an agent whose own
  vocabulary is coarser collapses the ones it cannot express, and one
  that has no notion of effort hides the control. **Chips remember the
  last choice, except `full`**: a permission level that escalated itself
  because it was used once is the failure
  [`../../04-security-review.md`](../../04-security-review.md) exists to
  prevent, so a stored `full` reads back as `ask` and every new session
  starts there. The memory is the browser's — the host, the agent, the
  model and the effort, in `localStorage`, on the device that chose
  them. It is a convenience, not a record: the scope is never
  remembered, because the repositories one visit is about are not the
  next visit's.
- The pane beside the sidebar has four states, and each is a URL:
  `/sessions/new` (the composer), `/sessions/{id}` (the terminal, or the
  provisioning pane while the session is starting, or a closed session),
  `/sessions` (nothing open: "No sessions open", and the way to start
  one), and anything else (a 404 that keeps the sidebar rather than a
  bare page).
- Provisioning: named steps with a ring, a check and a mono meta line
  (container or host, clone, checkout, start the agent), an elapsed
  clock and a status word, so a slow step is diagnosable. With several
  repositories the steps read "Clone N repositories" and "Check out
  branches".
- Session: terminal full-bleed, tabs (tmux windows, window 0 the
  agent, the rest shells in the same worktree), thin status line with host,
  branch, account, state, measured echo latency; login URLs as a
  button; phone layout with a key bar.
- Settings drawer: hosts with the install command, the agent prompt,
  an online dot, and the preflight result (git, tmux, claude). Not in
  version 1 — the frames draw no way to open it, so it is designed here
  and built with the slice that needs it.
  Accounts arrive with the accounts slice.
- A host row also carries what the update story needs to be operable on
  a fleet of one: the running **version**, the **channel**, whether it
  is **pinned** (and to what), and the **last update outcome** —
  including a rollback, which is the one a person must not have to find
  in a log. A host that has silently stopped updating is the failure
  nobody notices, so pinned and failed are states the row shows rather
  than states you infer from a version that stopped moving. Actions:
  Update now, change channel, pin/unpin (09 §5).
- Web framework open: Vite SPA recommended, Next.js as a client app
  acceptable. Decide at step 3.

## Open questions

1. ~~Session naming: user-typed, derived from the first task, or from
   the branch?~~ **Decided: derived from the first task**, and the
   sidebar shows that. A session is minted with a slug, because the
   directory and the branch have to exist before anything has been
   typed; the first prompt then names it through a configured model, and
   a name a person typed is never overwritten by one a model derived
   (03). The branch was the alternative and says less: several sessions
   on one repository would read alike, and the branch is already on the
   status line.
2. State dot colors and what "blocked" looks like on the card: a dot,
   a badge, or the last line of output?
3. Phone key bar contents: Esc, Tab, Ctrl, arrows, paste. Anything
   else?
4. Where do usage meters go later, so the status line leaves room?
5. **A policy that forbids `full`.** A host is somebody's laptop. Should
   a workspace be able to refuse full access outright, and is that a host
   setting or a workspace one?
6. **Model discovery.** Codex ships an empty model list rather than
   invented ids, so its engine pane names the agent and offers nothing.
   Orca probes the CLI and degrades to the catalog seed on a failed
   probe. Do we probe at pairing time and put the result on
   `host.capabilities`, or stay with the seed for version 1?
5. ~~Dark only, like the mockups, or both themes?~~ Both; the version-1
   frames and the design system carry both, "Match system" the default.
