---
"@oppenheimer/shared": minor
"@oppenheimer/backend-agents": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": patch
---

Grok as a bot model provider (`product/versions/mvp/25-bots.md` §2).

- `@oppenheimer/shared`: `xai` in `BOT_PROVIDERS`, after OpenAI and before GLM
  in `BOT_PROVIDER_PREFERENCE`, with Grok 4.7 (effort low to extra high) and
  Grok Build 0.1 (no effort) in its catalog row.
- `@oppenheimer/backend-agents`: `XaiBotEngine`, the OpenAI engine pointed at
  xAI's Responses API (`api.x.ai/v1`).
- `@oppenheimer/api`: `xai` in the provider checks of `bot`, `bot_turn` and
  `model_provider_credential`; its key is stored like OpenAI's.
- `@oppenheimer/web`: Grok's row in Settings → Model providers, drawn with
  Grok Build's mark in the model button.
