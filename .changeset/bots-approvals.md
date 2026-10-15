---
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": patch
---

Bots, the Needs input card (`product/versions/mvp/25-bots.md` §5).

- `@oppenheimer/shared`: `BOT_APPROVAL_STATUSES`, `decideBotApprovalSchema`,
  `findBotApprovalsSchema`, the `event` message role and the `approval`
  stream event.
- `@oppenheimer/api`: `bot_approval`; under Approve for me an asking tool's
  call becomes a pending approval (one per bot) instead of running;
  `GET /v1/bots/:id/approvals` and
  `POST /v1/bots/:id/approvals/:approvalId/decision`, which runs the stored
  call as the owner on a yes and queues a turn opened by an `event` message
  either way; a new message expires the card. Errors `BOTS_015`, `BOTS_016`.
- `@oppenheimer/api-client`: the approval operations.
- `@oppenheimer/frontend-consumer`: approvals on the bots repository and their
  hooks.
- `@oppenheimer/web`: the Needs input card above the composer, and the event
  line in the transcript.
- `@oppenheimer/translations`: the card's copy and `errors.byCode.BOTS_015`–`BOTS_016`.
