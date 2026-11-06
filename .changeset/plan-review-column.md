---
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/web": minor
"@oppenheimer/design-system-web": minor
"@oppenheimer/translations": minor
"@oppenheimer/cli": minor
"@oppenheimer/mcp": minor
"@oppenheimer/web-showcase": patch
---

Plan's board drops the Later column and gains In review, between In
progress and Done: `TASK_STATUSES` is `todo`, `doing`, `review`, `done`.
A migration moves every task in Later to the end of To do, in its order,
and bumps its version. Attaching a session still moves a task in To do to
In progress. The CLI's and MCP server's status choices, the bots' plan
tools and `tasks.columns` follow.
