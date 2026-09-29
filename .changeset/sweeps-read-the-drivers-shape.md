---
"@oppenheimer/api": patch
---

The two claim-and-restage sweeps recover the rows they were written to recover.

`AutomationRunRepository.restageStalled` and
`InboundEventRepository.restageUnprocessed` both read an `UPDATE … RETURNING`
as if TypeORM answered it with the rows. It answers `UPDATE` and `DELETE` with
`[rows, affected]`, so each sweep looped over an array and a number, staged two
jobs a tick whose `runId` / `inboundDeliveryId` was `undefined` — which the
processor logged as "Unknown … job" and dropped — and never re-dispatched a
run or restaged a delivery that was genuinely stuck. `restageUnprocessed` also
reported a constant two abandoned deliveries.

On a host left running, that was a garbage `outbox_message` row every thirty
seconds (nearly four thousand of them here) and a matching BullMQ completed
key, forever. The rule is now in `.agents/rules/typeorm.md`, and both sweeps
have a regression test whose fake query answers in the driver's shape.
