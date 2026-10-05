---
"@oppenheimer/api": patch
---

Session cache follow-ups:

- Signing out every device of a user holding more than a hundred sessions now
  evicts every cached copy. Better Auth hands its `session.delete.before` hook at
  most a hundred rows of a bulk delete, so the rest stayed live in Redis whenever
  its own per-user index had lost them; the hook now evicts all of the user's
  rows when they hold more than it is handed.
- The admin session list, and revoking one of a user's sessions by id, read the
  `session` table instead of Better Auth's Redis index, so a session signed in
  before the cache existed (or whose index entry was lost) is listed and can be
  revoked.
