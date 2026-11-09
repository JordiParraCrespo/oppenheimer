---
"@oppenheimer/api": patch
"@oppenheimer/backend-core": minor
"@oppenheimer/shared": minor
"@oppenheimer/translations": patch
---

A bot turn no longer dies with "unsupported Unicode escape sequence" when a
tool brings in text Postgres cannot store, such as an invoice PDF whose text
layer holds NUL bytes (#728). The chat's messages drop NULs and replace lone
surrogate halves before they are written (`storableText` and `storableJson` in
`@oppenheimer/backend-core`), and `read_mail_attachment` cleans what it
extracts. A call whose result is still refused fails that call alone, and the
turn goes on; any other refused write ends the turn with the new failure kind
`storage`, whose card says the fault is ours, not the model provider's.
