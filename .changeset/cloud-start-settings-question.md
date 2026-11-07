---
"@oppenheimer/runner": patch
---

Cloud starts work again with Claude Code 2.1.31x, which asks once per machine
"Use this machine's settings in cloud sessions?" before `claude --cloud`
creates a session. Unanswered, the question held every start the runner made
until it timed out. The runner now answers it with "No, keep them on this
machine" (what cloud sessions did before the question existed) when the
person has not answered it, never overwrites an answer they gave, and fails
a start at once, saying how to answer, if the question still shows.
