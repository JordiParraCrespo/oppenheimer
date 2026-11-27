---
"@oppenheimer/api": minor
---

A bot can set an advisor when asked: `update_bot` takes `advisor_model` (an id
or label the bots' model takes, `null` to turn it off; any other is refused
with the ones it takes), and `get_self` and `get_bot` say a bot's advisor.
