---
"@oppenheimer/auth": minor
---

Add `consumeSessionPreload`, which takes the answer from a session request
issued before the bundle parses, once, and falls back to the auth client for
anything unusable — so the worst case is a wasted request rather than a reader
treated as signed out.
