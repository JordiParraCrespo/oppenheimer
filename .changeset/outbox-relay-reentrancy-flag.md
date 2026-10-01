---
"@oppenheimer/backend-ddd": patch
---

`OutboxRelay.drainOnce()` recognises a call from inside a delivery with a flag
that is true only while the publisher's promise is pending, instead of
`AsyncLocalStorage`, whose context also followed a handler's detached work
after the delivery had ended.
