---
'@oppenheimer/shared': minor
'@oppenheimer/api': minor
'@oppenheimer/api-client': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/web': minor
'@oppenheimer/translations': minor
---

A bot's Needs input card is a request with server-chosen decisions. The
approval carries `availableDecisions` (`approve`, `approve_for_subject`,
`approve_always`, `deny`, `stop`, in the order to draw them) and
`POST /v1/bots/:id/approvals/:approvalId/decision` accepts only those
(`BOTS_030` otherwise; the older `approve` with a `reach` still works).
`deny` gives the bot a turn to carry on from; `stop` gives it none, writes
the decision as a chat line outside any turn and asks the asking turn to
stop. Every decision, and a card retired by a new message, is broadcast on
the bot's stream as `approval_resolved`, so each open chat takes the card
down at once and draws the decided line until the stored one lands; an
approval event names its card (`approvalId`). The card draws its buttons in
the API's order with keys (`y`, `p`, `a`, `n`, `c`), and a card raised while
the bot's text is half a line waits for the line to end, at most 600 ms.
