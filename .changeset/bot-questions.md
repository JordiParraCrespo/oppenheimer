---
'@oppenheimer/shared': minor
'@oppenheimer/api': minor
'@oppenheimer/api-client': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/frontend-web': minor
'@oppenheimer/web': minor
'@oppenheimer/translations': minor
---

A bot can ask its owner questions. `ask_user` puts up to four questions,
each with two to four likely answers, on a Needs input card and ends the
turn. The card is a `bot_approval` row whose status ends `answered`, with
the `answers` stored beside it; `POST /v1/bots/:id/approvals/:id/decision`
takes `answer` with `answers`, or `deny` to dismiss it (`BOTS_035`,
`BOTS_036`). The bot's next turn is told each answer, fenced as data, and
the chat draws them under the line. The console answers with
`ChatQuestionPicker`, the session question picker moved into the platform
kit, whose keys moved to `common.chat.question`.
