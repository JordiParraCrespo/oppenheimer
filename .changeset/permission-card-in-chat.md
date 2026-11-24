---
"@oppenheimer/shared": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/design-system-web": minor
"@oppenheimer/translations": minor
"@oppenheimer/web": minor
---

When Claude Code or Codex stops to ask permission for a tool, the session chat answers it in the composer's place: the command (coloured, under the agent's own description), or the file and a short diff of the edit, then Allow once, Always allow (in the agent's own words for what it would stop asking about) and Deny, with 1–3, Enter and Esc as in the terminal and Deny with a note. A command that deletes a tree or rewrites shared history tints the card amber. The dialog is read off the terminal with each agent's spec beside the question keys (`permissionPromptOf`, `permissionChoiceKeys` in `@oppenheimer/shared/sessions`); an agent with none keeps the status line. `ApprovalPanel` takes `tone`, `picked`, `disabled`, `autoFocus`, `foot` and `onDismiss`.
