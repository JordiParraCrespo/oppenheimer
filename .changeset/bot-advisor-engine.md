---
"@oppenheimer/shared": minor
"@oppenheimer/backend-agents": minor
---

A bot's turn can consult an advisor, a stronger Claude model, mid-turn.

- `@oppenheimer/shared`: each Anthropic bot model lists the advisors it takes
  (`BotModel.advisors`, from Anthropic's pairing table, a model never paired
  with itself), and `botAdvisorFor` answers whether a pair is one of them.
- `@oppenheimer/backend-agents`: `BotTurnRequest.advisorModel` turns
  Anthropic's advisor tool on through Claude Code, on Anthropic's own API
  only, and the turn's `usage` reports what the advisor spent apart, on its
  own model.
