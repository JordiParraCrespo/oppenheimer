---
'@oppenheimer/shared': minor
'@oppenheimer/api': minor
'@oppenheimer/api-client': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/web': minor
'@oppenheimer/translations': minor
---

A bot can ask its owner to fill a form. `ask_form` puts a title, a line on
what it is for, one to eight typed fields (`text`, `textarea`, `number` with
bounds, `select`, `email`, `date`) and the button's word on a card of its
own, and ends the turn, the way `ask_user` does. The form is a `bot_form`
row: `GET /v1/bots/:id/form` reads the waiting one, and
`POST /v1/bots/:id/forms/:formId/submit` and `/dismiss` decide it
(`BOTS_046` to `BOTS_048`); the values are read against the fields, and a
bot has one card up at a time of any kind. The next turn, of origin
`question`, is told each value fenced as data, and the chat draws a `form`
event with each field's label over the value sent. The console fills it with
React Hook Form over `botFormInputSchema`, checking each field as it is
left, and says "Sent" for a moment before the record takes its place.
