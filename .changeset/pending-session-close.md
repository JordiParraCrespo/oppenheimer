---
"@oppenheimer/api": patch
"@oppenheimer/api-client": patch
"@oppenheimer/frontend-consumer": patch
"@oppenheimer/design-system-web": minor
"@oppenheimer/web": patch
"@oppenheimer/translations": patch
---

Deleted sessions no longer come back. A close the host has not answered is folded onto the session (`closeRequest`, and the host's refusal as `closeRefusal`, both on the session response), and the runner's hello is sent every owed close again with the `acceptUnpushedWork` it was asked with, whether or not the host holds the session; a restart request supersedes it. The migration backfills sessions already stuck. The console keeps a row the API still owes a close as "Deleting…", shows one its host refused as "Not deleted" with the host's reason in the delete dialog, and uses the `host_offline` hint to stop watching a close nobody will answer. `SessionItem` gains a `status` word that stays in the age's place.
