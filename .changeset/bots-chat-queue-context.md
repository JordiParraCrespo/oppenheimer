---
'@oppenheimer/backend-agents': minor
'@oppenheimer/api': minor
'@oppenheimer/api-client': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/frontend-web': minor
'@oppenheimer/translations': minor
'@oppenheimer/web': minor
---

A bot's chat queues what you write while it works and shows the room it has
left. Each waiting message sits over the composer with Remove, Edit and Send
now. The engines report the context of a turn's last answer (with the
model's window on the Claude engine) and, on a ChatGPT sign-in, the plan's
5-hour and weekly windows from the Codex usage headers; each turn keeps them
(`contextTokens`, `contextWindow`, `planLimits`) and the composer's meter,
now the platform kit's `ChatUsage` shared with the session chat, reads the
newest.
