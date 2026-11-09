---
'@oppenheimer/runner': patch
'@oppenheimer/frontend-consumer': patch
---

A prompt reads as the person typed it. Pasted text no longer shows the
`<pasted_content>` tags Claude Code wraps it in, and system reminders the CLI
adds before or after the words are left out. This applies to the session chat
and to the first message the runner reports. A message that opens with a
reminder is no longer dropped from the chat.
