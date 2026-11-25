---
"@oppenheimer/runner": patch
---

`runner status`, `runner update` or any command that builds the host agent, typed in a session on macOS, no longer breaks `runner` for every session after it. macOS names a running binary by the path it was started by, so a runner started through `bin/path/runner` pointed that link at itself, and every later `runner` through it failed with "too many levels of symbolic links" until the service restarted. A runner started through the link now leaves it as it is.
