---
"@oppenheimer/runner": minor
"@oppenheimer/web": patch
"@oppenheimer/shared": patch
---

Codex and Grok sessions get the chat view. The runner follows Codex's rollout
(the newest one written in the session's directory since it was created) and
Grok's ACP update stream (found by the session's id), and reads each as the
transcript lines the chat already draws: commands as Bash, patches and diffs as
edits with their lines, plans as the task list, a stopped turn as the
interrupted note. Codex's token counts become the composer's context and plan
meter. The chat names a model by the agent catalog's label.
