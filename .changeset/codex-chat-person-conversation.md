---
'@oppenheimer/runner': patch
---

A Codex session's chat stays on the person's own conversation. Codex 0.167
writes threads of its own in the session's directory (an approval's guardian
review, a compaction, a memory consolidation, an attached fork), and the chat
used to follow whichever rollout was newest. It then showed one turn with no
prompt and nothing typed after it. The runner now picks a rollout the way
`codex resume` does.
