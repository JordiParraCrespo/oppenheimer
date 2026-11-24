---
'@oppenheimer/shared': minor
'@oppenheimer/api': minor
'@oppenheimer/web': minor
'@oppenheimer/translations': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/api-client': minor
---

A bot checks back on anything it delegated or waits on. Its new `check_back`
tool (`about`, optional `minutes`; never asks, scope `bots:write`) wakes it
later with a turn of its own (origin `check_back`, background lane) to look
at a session, a pull request, a deploy, a person or a cloud run: at the time
it names, or on a backoff of 5, 10, 20, 40, 80 minutes then every 120, one
look a turn, for 24 hours from the first. A look's own call goes on with
its chain; once the thing is done the bot stops calling and the chain ends.
The look is a delayed job on the new `bot-check-backs` queue, its turn keyed
`check_back:<chain>:<step>` so a retry wakes the bot once. The chat opens
each look with "Checked back on: …" (a new `check_back` event kind), and
the system prompt now has a bot call `check_back` whenever it says it will
check, report or carry on later.
