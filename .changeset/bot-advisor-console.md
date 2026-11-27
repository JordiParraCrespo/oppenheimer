---
"@oppenheimer/web": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/translations": minor
"@oppenheimer/shared": patch
---

The bot composer has an Advisor chip beside the model: on a bot whose model
takes one (Anthropic's), it picks the stronger model its turns may consult,
or No advisor.

- `@oppenheimer/web`: `BotAdvisorChip`, drawn only when the bot's model lists
  advisors; its glyph alone in a narrow chat, as the approval chip.
- `@oppenheimer/frontend-consumer`: a bot carries `advisorModel`, and an
  update may set it.
- `@oppenheimer/translations`: its words, in English and Spanish.
- The guide bots read (`@oppenheimer/shared`, from the docs site): the bots
  page says what the advisor is and what it costs.
