---
"@oppenheimer/runner": patch
---

A Claude Code session's chat follows the conversation its agent is in, not
the one it launched in. After `/clear`, `/resume` or a resume that forks,
Claude Code writes to a conversation of another name; the chat stayed on the
old transcript, frozen at its last turn while the terminal kept working,
the context figure in its footer went stale, and Restart resumed the old
conversation. Window 0's status line now runs as
`runner statusline --session <id>` and keeps the conversation Claude Code
reports for that session. The chat moves to it at its next check, and the
session keeps it from the next poll, so questions, the first message and
Restart read it too. A second Claude Code in another window names no
session and moves nothing. A session started before this release reports
nothing until it is restarted.
