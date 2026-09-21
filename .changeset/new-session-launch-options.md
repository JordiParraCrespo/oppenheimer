---
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": major
"@oppenheimer/web": minor
"@oppenheimer/translations": minor
"@oppenheimer/design-system-web": patch
---

New session sets how a session is launched, and `POST /sessions` takes it.

The route grows a `launch` object — model, permission level, effort — and the
`prompt` typed into the composer. The launch is folded onto `work_session` so a
restart and the engine button can read it per row; the prompt is a log entry and
rides `session.create` to the host, so nothing about the composer waits on the
relay. It also names the session, through a new `openai-compatible` namer
provider that covers Groq, Together, vLLM and a local Ollama.

The agent catalog in `@oppenheimer/shared` grows each agent's models and the
argv its permission levels and effort stops map to, read off claude 2.1.278's
and codex-cli 0.155.1's own `--help`.

**Breaking, `@oppenheimer/frontend-consumer`:** `SessionEntity` was modelling one
repository, one branch and a `running | idle | stopped` state the control plane
had stopped sending. It carries `checkouts`, the derived `state` group and the
stored `lifecycle` now, and `create` takes an idempotency key from its caller.
