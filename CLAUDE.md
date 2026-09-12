# oppenheimer

Planning-phase repository for a browser-based terminal and VM
orchestrator. There is no code yet.

- All research and decisions live in `vision/`. Start with
  `vision/README.md`, which lists the notes in order and records the
  decisions that changed along the way.
- When a decision changes, update the note that made it and add a line
  to the "decisions that changed" list in `vision/README.md`. Do not
  silently rewrite history in earlier notes.
- The one-page brief `vision/brief.html` is regenerated from the notes;
  keep it in sync when a note changes.
- The MVP is Orca on the web without VMs: connect a host you own, run
  sessions on it as worktrees with a tmux terminal, Claude Code first
  (`vision/mvp/00-scope.md`). VMs, sleep, accounts, and Codex are the
  slices after. `vision/07-mvp.md` is superseded and kept for history.
- In-depth MVP design lives in `vision/mvp/`, one document per area,
  each with decided points and open questions, and its own decision
  log in `vision/mvp/README.md`.
