---
"@oppenheimer/backend-ddd": minor
"@oppenheimer/api": patch
---

The outbox relay renews its lease while it delivers a batch. A listener slower
than the lease (30 s by default) could be claimed and run a second time by
another replica's poll; now a heartbeat (`OutboxService.extendLease`, every
third of the lease) keeps the rows, fenced on the relay's owner. The marks that
end a delivery are fenced too: `markProcessed(ids, owner)` only marks rows that
owner still leases, and `markFailed` only touches the claim it came from, so a
relay that lost its lease anyway never finishes or releases another relay's
claim. `OutboxRelayOptions.heartbeatMs` sets the renewal interval.

Removed the unused `PaginatedQueryParams` and `OrderBy` types from the package's
exports; nothing in the workspace read them since list queries moved onto the
ports that need them.
