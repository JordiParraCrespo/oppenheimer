---
'@oppenheimer/design-system-web': minor
'@oppenheimer/frontend-web': minor
'@oppenheimer/translations': minor
'@oppenheimer/web': minor
---

The chats fold looking around and cap long output, after Codex. In a
session's chat a run of read-only calls (Read, Grep, Glob, LS, and a Bash
command that only lists, reads or searches) is one "Explored" line,
"Exploring" while it runs, naming what it looked at with each file once,
and opening to the calls; any other call ends the run. A bot's chat does
the same over its `get_`, `list_`, `read_` and `search_` tools and the web
search. A call's text output shows its first five lines, a long line cut
to its head and tail, under "+N lines". `ToolCallGroup` and `TraceGroup`
take a `detail`; `ToolCallOutput` is new, and `TraceOutput` cuts long
lines while it is cut and takes a `full` label.
