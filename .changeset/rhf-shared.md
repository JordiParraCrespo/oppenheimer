---
"@oppenheimer/shared": minor
---

The auth schemas no longer hardcode their failure messages. Zod short-circuits
any error map when a check states its own message, so
`z.string().email('Invalid email address')` pinned every consumer to English.
The shapes are unchanged, and nothing outside the two frontends read those
strings — the API authenticates through Better Auth rather than these schemas.

Adds a `./schemas/auth` export. Importing the schemas from the package root
pulls in the scope catalog and CASL, neither of which belongs in a browser
bundle; the narrow subpath depends on nothing but Zod.
