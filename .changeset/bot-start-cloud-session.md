---
"@oppenheimer/api": minor
---

Bots: `start_cloud_session` starts a Claude Code cloud session from a
project's repository through the sessions' own create with `cloud`, so the
host's runner runs `claude --cloud <task>` as it does for the console and for
automations. It asks first under Approve for me, as `start_session` does,
waits for the host to report the session and answers with its claude.ai URL.
`get_session` now shows a cloud session's URL.
