---
'@oppenheimer/shared': minor
'@oppenheimer/api': patch
'@oppenheimer/web': minor
'@oppenheimer/translations': minor
---

Settings → Skills lists the skills Oppenheimer gives every bot (`oppenheimer`
and `recap`) in a read-only "Built in" group under the bot's own, so a bot
saying it used one points at something the person can find. A view opens
each one's instructions; there is no edit or delete. The words moved to
`@oppenheimer/shared` (`BOT_BUILT_IN_SKILL_TEXTS`), which the API reads too.
