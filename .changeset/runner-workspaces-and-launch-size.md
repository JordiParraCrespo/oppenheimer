---
"@oppenheimer/runner": patch
---

Sessions stop handing the host's CPU to Spotlight, and launch on a plausible
terminal.

- **The workspace root is kept out of the desktop search index.** A session is
  a worktree with its dependencies installed, so a host running a few of them
  holds several complete copies of a repository — gigabytes across hundreds of
  `node_modules` directories, rewritten whenever an agent installs something.
  macOS indexed all of it: on a host with eight sessions open,
  `mdworker_shared` took more CPU than the agents, `tmux list-panes` passed its
  ten-second deadline, and the control-plane link missed its pings, so the
  terminals in the browser went blank. The runner now writes
  `.metadata_never_index` at the workspace root, both when a root is chosen and
  on every boot, so an existing pairing gets it without re-pairing. Deleting
  the file turns indexing back on.
- **A detached session launches at 132x40 rather than tmux's 80x24.** An agent
  lays its turn out for the terminal it is told about, so a session created and
  left alone — every session between "send" and the reader opening it, and
  every session an automation runs — did its work in 80 columns and then
  reflowed into the console's ~130 when someone finally looked. `window-size
  latest` still hands the window to a real viewport the moment one attaches.
