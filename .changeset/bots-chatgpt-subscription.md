---
"@oppenheimer/backend-agents": minor
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": patch
---

Bots on a ChatGPT subscription (`product/versions/mvp/25-bots.md` §2): a fourth
provider, `chatgpt`, signed in rather than given a key, the way OpenClaw and the
Codex CLI do it.

- Settings → Model providers has a ChatGPT row with Connect ChatGPT: OpenAI's
  device code flow, a one-time code typed on OpenAI's page, polled until the
  person approves it (`POST /v1/model-providers/chatgpt/login` and
  `…/login/poll`). The sign-in's tokens are sealed like a key.
- The OpenAI engine runs `chatgpt` turns against ChatGPT's Codex backend with
  the account header, `store: false` and encrypted reasoning.
- The worker refreshes the token before a turn when it is about to lapse, one
  refresh per workspace at a time, written only over the tokens it read; a
  refresh ChatGPT refuses removes the sign-in.
- New problems `BOTS_015`–`BOTS_018`; `PUT /model-providers/chatgpt` answers
  `BOTS_015`.
