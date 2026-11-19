---
'@oppenheimer/api': minor
'@oppenheimer/shared': minor
'@oppenheimer/cli': minor
'@oppenheimer/mcp': minor
'@oppenheimer/api-client': minor
---

A session's whole conversation can be read: the transcript reads from its first turn with `from=start` (`read_session_transcript` for bots and MCP, `opp sessions transcript --from-start`), every page says with `hasEarlier` whether turns came before it, and `opp sessions transcript --all` reads it from the first turn to the last.
