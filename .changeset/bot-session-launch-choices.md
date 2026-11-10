---
'@oppenheimer/api': minor
'@oppenheimer/shared': patch
---

A bot starts a session the way the person asks for it: `start_session` takes
the composer's whole foot row and branch (`model` by catalog id or name, such
as "Opus 5.5", `effort`, `permission`, `base_branch`), refuses a choice the
agent does not take with the ones it does, and names each choice on the Needs
input card. An eval holds it (`scripts/evals/bot-session-launch/`).
