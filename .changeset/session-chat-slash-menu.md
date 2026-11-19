---
"@oppenheimer/runner": minor
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/frontend-web": minor
"@oppenheimer/web": minor
---

Typing `/` in a host session's chat opens a menu of what `/<name>` runs: the project's skills and commands, then Claude Code's own commands (`/clear`, `/compact`, `/context`, `/cost`, `/init`, `/review`). The runner reads the project's from `.claude/skills` and `.claude/commands` in the folder the agent runs in and sends their names and descriptions with the chat's history (`attachment.chat`'s new `commands`); a host on an older runner gets the built-ins alone. The kit's `useCommandMenu` and `matchingCommands` now drive both this menu and the bots one.
