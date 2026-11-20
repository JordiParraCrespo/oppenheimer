---
"@oppenheimer/runner": minor
"@oppenheimer/shared": minor
---

The runner reports, on each WhatsApp message, whom it @-mentions
(`mentions`) and who wrote the message it replies to (`quotedSenderId`),
both by phone number the way senders are, the linked number's own `@lid`
id included. Optional on the wire, so an older runner or control plane
ignores them. This is what lets an allowed group wake its bot only when
someone speaks to the number.
