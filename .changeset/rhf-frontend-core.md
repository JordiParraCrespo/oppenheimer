---
"@oppenheimer/frontend-core": minor
---

Add a `/validation` entrypoint exporting `createZodErrorMap`, which re-derives
a message from the Zod issue code and resolves it against a `validation.*`
translation key. `TranslateFn` is deliberately narrow — a `t` typed over the
full catalog is assignable to it, so a missing key is a compile error rather
than a raw key rendered to the user.
