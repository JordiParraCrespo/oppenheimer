---
"@oppenheimer/runner": patch
---

A Claude Code session showing a suggested next prompt after a turn is read as idle. Claude Code 2.1 puts the suggestion in the input box, which the prompt rule only recognised when empty, so those sessions still read `unknown` and their turns never completed.
