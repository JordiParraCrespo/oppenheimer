---
"@oppenheimer/runner": patch
---

A stage that fails its self-check, or cannot be promoted, is deleted instead
of left in `~/.oppenheimer/bin/.staging`, and each boot deletes what has sat
there for over an hour. A Mac whose update kept failing had 22 copies there.
