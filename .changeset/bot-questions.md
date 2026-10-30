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
each with two to four likely answers, on a card and ends the turn. The card
is its own `bot_question` row, beside approvals rather than a kind of one:
`GET /v1/bots/:id/question` reads the waiting card, and
`POST /v1/bots/:id/questions/:questionId/answer` and `/dismiss` decide it
(`BOTS_035` to `BOTS_037`). A bot has one card up at a time of either kind.
The tool is offered only on turns a person is waiting on (`attendedOnly`).
The bot's next turn, of origin `question`, is told each answer fenced as
data, and the chat draws a `question` event with each answer under the
line. The console answers with `ChatQuestionPicker`, the session question
picker moved into the platform kit, whose keys moved to
`common.chat.question`.
