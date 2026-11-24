---
"@oppenheimer/runner": minor
"@oppenheimer/web": minor
"@oppenheimer/api": patch
"@oppenheimer/shared": minor
"@oppenheimer/api-client": patch
"@oppenheimer/design-system-web": patch
"@oppenheimer/docs": patch
---

Qwen Code (`qwen`, `@qwen-code/qwen-code`) is an agent a session can run, with
a Chat view. It offers Qwen3.8 Max (its default), Qwen4 Max, Qwen3.7 Plus and
Qwen3.8 Flash, with Qwen3.7 Max under More models, and no effort level, which
Qwen takes only as a setting. Its permission levels are `--approval-mode
default`, `auto` and `yolo`. The first task rides as
`--prompt-interactive=<task>`, one word, so a task that starts with `-` is
not read as a flag: the runner now replaces `<prompt>` inside a word. A
restart reopens the folder's newest conversation with `--continue`, since
`--resume <id>` exits until something has been said. Before a message is
typed, the runner, the API and the console empty Qwen's prompt, which an Up
arrow, a stopped turn or a rewind can leave holding text.

`runner agents install qwen` installs it from npm (Node.js 22). The chat reads
Qwen's conversation file under `~/.qwen/projects/` (or `$QWEN_HOME`), and in a
worktree session follows the conversation Qwen moves to on a `/clear`. Qwen
Code is off in Settings → Agents until switched on, and wears Qwen's mark.
