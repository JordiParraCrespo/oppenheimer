---
"@oppenheimer/go-core": minor
---

`filelock`: a lock other processes on the host see, a flock on a named
file. `Acquire(ctx, path)`, `TryAcquire(path)`, `Held(path)` and
`Wait(ctx, path)`. The runner's session map and git stores are its first
users.
