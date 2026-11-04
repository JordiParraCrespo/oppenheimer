---
"@oppenheimer/shared": minor
"@oppenheimer/runner": minor
"@oppenheimer/api": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
---

A Claude Code session's chat is sent tail first. An attach sends the last 40
turns, from the line that opens the first of them, and says where they
start (`before`); scrolling to the top of the chat asks the host for the 40
turns before that (`chat.older` on the attach socket, `attachment.chat.older`
on the link, capability `attachment.chat.older`), shown with the spinner
until the page has come. A reconnect's tail is checked against what the
chat holds from where it starts, so older pages stay. Codex, Grok and
OpenCode sessions still send their whole history.
