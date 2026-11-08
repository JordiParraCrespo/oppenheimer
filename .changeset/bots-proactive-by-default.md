---
"@oppenheimer/api": minor
---

Bots are proactive by default, as OpenClaw's are. "How a turn goes" tells a
bot that a failed step is not the end of the request: it works out why and
tries the next reasonable route within its permissions (another online host,
another query or source, another approach) before it reports a blocker,
never the same thing the same way twice and never around a person's "no",
and that saying what it is about to do is not a result. "Working on code
through sessions" starts on another online host when the chosen one cannot
run the agent (offline, not signed in, not installed). The `failed` session
wake starts a task that failed because of its host once on another host that
can run it, never again on one it failed on; a task that fails on its own
merits is still reported, not retried.
