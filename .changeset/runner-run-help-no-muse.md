---
"@oppenheimer/runner": patch
---

`runner sessions run --agent` and the MCP `start_session` tool no longer offer Muse or ZCode for a child: neither takes a first task, so a child started on one was refused. The MCP tool now names Oh My Pi, which it accepted but did not list.
