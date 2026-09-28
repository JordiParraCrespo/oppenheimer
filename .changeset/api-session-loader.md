---
"@oppenheimer/api": patch
---

Internal cleanup with no change on the wire: the OpenAPI document and every
problem document stay the same.

- Session commands and queries load their session through
  `SessionLoaderResolver` (`find`, and `requireLive` for the commands that
  refuse a resolved session); closing a resolved session is still a no-op.
- Automation handlers use `requireFound` for their not-found check.
- The users and roles list queries use `@oppenheimer/shared`'s
  `paginationSchema`, and the four list endpoints build `meta` with
  `toPageMeta` and their response DTOs with `PaginatedResponseDto`.
