---
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": patch
---

Bots: a Needs input card approves one exact call, for a while, and
`delete_bot` (`product/versions/mvp/25-bots.md` §4.6, §5).

- `@oppenheimer/shared`: `decideBotApprovalSchema` requires `callDigest`
  with `approve`.
- `@oppenheimer/api`: `bot_approval."callDigest"` and `"expiresAt"`
  (`BindBotApprovals`, backfilled). A yes must name the card's digest
  (`BOTS_024`), a card past its time expires instead of being decided
  (`BOTS_023`), and a tool's role rule binds the approver (`BOTS_025`) and the
  owner when the call runs; the job re-checks the digest before running.
  Tools can always ask (Full access too) and set their card's window. New
  tool `delete_bot`: always asks, 15-minute card, never itself, a bot named
  wrong or one that is answering, checked again when it runs.
- `@oppenheimer/api-client`: `callDigest` and `expiresAt` on approvals,
  `callDigest` on the decision.
- `@oppenheimer/frontend-consumer`: approvals carry their digest and expiry;
  `decideApproval` takes `{ note, callDigest }`.
- `@oppenheimer/web`: Approve sends the card's digest; an expired card says
  so and offers no buttons.
- `@oppenheimer/translations`: `bots.chat.approval.expired`,
  `errors.byCode.BOTS_023`–`BOTS_025`.
