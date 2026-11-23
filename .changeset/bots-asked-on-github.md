---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/web": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/api-client": minor
"@oppenheimer/translations": minor
---

A bot can be asked on GitHub. The workspace owner's `@oppenheimer <bot>`
in a pull request or issue comment or review, or the label `bot:<bot>`,
queues a background turn of that bot (origin `github`) with what was
written as untrusted data, and the turn's last words are posted back there
as one comment by the GitHub App (`AddAppIssueCommentCommand`), which wakes
nothing of ours. Anyone else's mention or label does nothing. The bot's
chat shows a `github_ask` line linking to the ask. Comment events now carry
`isPullRequest`, and the workspace lookup answers a workspace's owner.
