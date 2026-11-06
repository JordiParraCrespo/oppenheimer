---
"@oppenheimer/api": minor
---

Bots are proactive by default (`26-bot-routines.md` §6): every new bot is
born with a **Heartbeat** routine that wakes it once an hour, at a minute
spread by its id, to check in on what it looks after (its plan, sessions,
watched pull requests, mail), act on what needs it and `notify` what the
person must know. A beat with nothing to say calls the new
`nothing_to_report` tool and writes nothing; the tool is offered only on
turns nobody is waiting on. Creating a bot now raises
`BotCreatedDomainEvent` on the outbox with the bot, carrying the creating
credential's scopes, which the heartbeat keeps.
