---
"@oppenheimer/runner": patch
---

A Claude Code session back at its empty prompt after a turn is read as idle again. Claude Code 2.1 draws the prompt as `❯` and a no-break space, which the manifest's prompt rule did not match, so the session read `unknown`, its turn never completed, and a bot that sent a follow-up never heard it finish.
