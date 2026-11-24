---
"@oppenheimer/web": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/design-system-web": minor
"@oppenheimer/translations": minor
"@oppenheimer/web-showcase": patch
---

A session's chat shows what a running command last printed, and marks a
move to another model.

- `@oppenheimer/frontend-consumer`: `readAgentActivity` also reads the
  shell call in flight above Claude Code's spinner, its last three lines
  (600 characters at most) as `ChatActivity.tail` (`readCommandTail`), off
  the screen of its inline renderer; its fullscreen renderer shows no
  output, so nothing is read there. A transcript line on another model
  than the agent last answered on brings a `model` step before what it
  wrote; Claude Code's `<synthetic>` lines name no model.
- `@oppenheimer/web`: the running command's live row has the tail under
  it, for that command only, until its result lands; a model change is a
  `ChatMarker` ("Model changed to Haiku 5"), kept when the turn folds.
- `@oppenheimer/design-system-web`: `ToolCallTail`, a three-line window
  of a command's last output under its `ToolCallLive`.
- `@oppenheimer/translations`: `sessions.chat.notice.model`.
- `@oppenheimer/web-showcase`: the Work and tools demo draws a tail.
