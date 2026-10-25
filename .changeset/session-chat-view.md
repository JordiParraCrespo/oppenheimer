---
"@oppenheimer/shared": minor
"@oppenheimer/runner": minor
"@oppenheimer/api": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/design-system-web": patch
"@oppenheimer/translations": patch
---

A Claude Code session read as a chat, a proof of concept behind
`session_chat_view` (`product/next-steps/0.7-terminal-and-chat.md`).

- `@oppenheimer/shared`: `attachment.chat` on the link (capability
  `attachment.chat`, `ChatEntryMaxBytes`, `ChatBatchMaxEntries`), `chat` on
  the attach socket, the `session_chat_view` release flag.
- `@oppenheimer/runner`: while a browser is attached to a Claude Code
  session, the runner follows its transcript and sends each line compacted
  (no images, no thinking signatures, tool output and written files cut).
- `@oppenheimer/api`: the relay hands `attachment.chat` to the attachment's
  browser, for a person the flag is on for and never through a share.
- `@oppenheimer/frontend-consumer`: `SessionChat`, the entries read into
  turns of typed steps; `SessionStream.onChat`.
- `@oppenheimer/web`: Terminal / Chat in a session's status bar; the chat
  draws turns, tool calls and the task list, and types into the PTY.
- `@oppenheimer/design-system-web`: the `chat-ground` token.
- `@oppenheimer/translations`: `sessions.chat.*`.
