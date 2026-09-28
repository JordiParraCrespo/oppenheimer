---
"@oppenheimer/api": patch
---

Banned and deactivated accounts are refused on every credential.

- One rule, `isAccessAllowed` (`auth/domain/account-access.policy.ts`): an
  account may act unless it is deactivated or under a ban that has not expired.
- API tokens and OAuth (MCP) access tokens of a banned owner now get
  `TOKEN_003`; before, only `isActive` was checked.
- A browser session (cookie, or session token as bearer) of a deactivated or
  banned account now gets `AUTH_001`, with the same detail as no session;
  `OptionalApiAuthGuard` routes treat the caller as anonymous.
- Deactivating an account through `UpdateUserCommand` raises
  `UserDeactivatedDomainEvent`; its handler deletes the account's Better Auth
  sessions and rotates its delegated-session generation.
- `AdminService.ban` and `.unban` rotate the delegated-session generation, so
  façade calls through a credential work again straight after an unban.
