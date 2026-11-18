---
'@oppenheimer/backend-agents': patch
---

A bot signed in with ChatGPT no longer shows its weekly limit at 0% when ChatGPT sends an empty placeholder for it (0% used, no length, no reset); the row is left out, as the Codex CLI does. The 5-hour and weekly windows are told apart by their length rather than by which header carried them.
