---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/web": patch
"@oppenheimer/translations": minor
"@oppenheimer/api-client": minor
---

A bot on an Anthropic model can have an advisor, a stronger Claude model its
turns may consult mid-turn.

- `@oppenheimer/api`: `bot."advisorModel"` (`PATCH /bots/:id` sets it, `null`
  turns it off), kept valid with the provider, model and effort: one its
  model does not take, or a change that drops it, is none. A turn reads it as
  it runs and sends it only when the turn's model takes it. What the advisor
  spends is recorded as the bot's model call under the purpose `advisor`,
  priced as its own model, and counted in the engine's token metric.
- `@oppenheimer/shared`: `updateBotSchema.advisorModel`, and `advisor` among
  `BOT_MODEL_CALL_PURPOSES`.
- `@oppenheimer/web`: `/usage` names the advisor's consultations.
- `@oppenheimer/translations`: their label, in English and Spanish.
- `@oppenheimer/api-client`: regenerated.
