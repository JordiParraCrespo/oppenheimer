---
"@oppenheimer/api": minor
---

Sign-up grants the default role and provisions the personal workspace through domain use cases rather than SQL in a Better Auth hook. A slug with no URL-safe characters falls back to `workspace-…` everywhere, and `ROLE_007` replaces a bare 500 when a system role is missing.
