---
"@oppenheimer/auth": minor
---

Extract the Better Auth configuration both sides must agree on into this new
package: the user-fields schema (consumed by the server's
`user.additionalFields` and the clients' `inferAdditionalFields`), the shared
client plugin set (`admin`, `organization` with the `teams` flag), and the
`unwrap()` / `toAuthSession()` helpers previously copy-pasted into both client
adapters. The `./client` entry ships TypeScript sources to preserve Better
Auth's type inference; the root entry is compiled CJS for the NestJS API.
