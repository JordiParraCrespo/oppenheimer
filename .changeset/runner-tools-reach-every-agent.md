---
"@oppenheimer/runner": patch
---

A session's agent reaches the runner's tools again. Its MCP server (`notify`, `send_file`, `wake_in`, `watch_pull_request`, child sessions) was started as a bare `runner`, and `runner --skill` was found by name, through a PATH tmux never gave the pane: tmux takes a pane's PATH from the client that spawns it, not from the session's `-e`. The MCP server now starts by the runner's own path, and the runner carries `bin/path` on its own PATH, which every pane inherits.
