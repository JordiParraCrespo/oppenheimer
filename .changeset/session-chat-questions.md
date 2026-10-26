---
"@oppenheimer/design-system-web": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/translations": patch
"@oppenheimer/web": minor
---

A session read as a chat answers the questions Claude Code asks (`AskUserQuestion`). The questions take the composer's place, one at a time, each option picked by its row or its number, several where the agent allows them, or answered in the person's own words; Submit types the keys Claude Code's picker takes, and Dismiss is Escape. The transcript keeps what was asked and answered, or that it was dismissed, and a watcher sees that the agent is waiting. `SessionChat.answer` sends the answers, `ChatToolCall` carries `questions` and `answers`, and `QuestionPanel` takes a set of picks where several are allowed.
