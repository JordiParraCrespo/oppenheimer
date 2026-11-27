---
"@oppenheimer/api": patch
"@oppenheimer/frontend-web": patch
"@oppenheimer/web": patch
"@oppenheimer/runner": patch
---

Hardening from the pre-launch security review.

- `@oppenheimer/api`: the preview cookie is `__Host-oppenheimer_preview`, so a
  sibling preview cannot plant one; every copy a request carries is tried, and
  every `Domain` is taken off an app's `Set-Cookie` (a reader holding the old
  `__oppenheimer_preview` re-enters through a fresh ticket). A preview path
  with a control character opens the app's root. A token minted with an API
  token may not outlive it, or be accepted from addresses outside its IP
  allowlist (`TOKEN_002`). Production refuses the development database
  password.
- `@oppenheimer/frontend-web`: `sanitizeRedirect` drops a path holding a
  control character or a backslash (`/\t/evil.example` read as `//evil.example`).
- `@oppenheimer/web`: nginx's access log keeps no query string (and cuts the
  `Referer` at its `?`), and writes the token in a password-reset link's,
  a cloud file's and a routine webhook's path as `[redacted]`; `CSP_EXTRA_ORIGINS` is split into
  `CSP_CONNECT_ORIGINS` and `CSP_SCRIPT_ORIGINS`, and the old variable now
  widens `connect-src` only.
- `@oppenheimer/runner`: `host.exec` refuses a bot folder (`home`) that is not
  one plain name (`EXEC_003`).
