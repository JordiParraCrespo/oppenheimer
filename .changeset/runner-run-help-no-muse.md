---
"@oppenheimer/runner": patch
---

The runner's `--agent` help and the MCP `start_session` tool list agents from the runner's own table rather than by hand, so a command that starts an agent with a task no longer offers Muse or ZCode, which take none and were refused. The MCP tool now also names Oh My Pi, which it accepted but did not list.
