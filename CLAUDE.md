# oppenheimer

Planning-phase repository for a browser-based terminal and VM
orchestrator. There is no code yet.

- All research and decisions live in `product/`. Start with
  `product/README.md`, which lists the notes in order and records the
  decisions that changed along the way.
- When a decision changes, update the note that made it and add a line
  to the "decisions that changed" list in `product/README.md`. Do not
  silently rewrite history in earlier notes.
- The one-page brief `product/brief.html` is regenerated from the notes;
  keep it in sync when a note changes.
- The MVP is Orca on the web without VMs: connect a host you own, run
  sessions on it as worktrees with a tmux terminal, Claude Code first
  (`product/versions/mvp/00-scope.md`). VMs, sleep, accounts, and Codex are the
  slices after. `product/07-mvp.md` is superseded and kept for history.
- In-depth MVP design lives in `product/versions/mvp/`, one document per area,
  each with decided points and open questions, and its own decision
  log in `product/versions/mvp/README.md`.
