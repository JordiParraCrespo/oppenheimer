---
"@oppenheimer/shared": minor
---

Put the endpoint policies next to CASL, and stop exporting `./navigation`.

`SCREENS` paired a web route (`/team`, `/api-tokens`) with the endpoint behind
it and the rules that endpoint demands. The endpoint half is a real contract
and stays, as `ENDPOINT_POLICIES` in `@oppenheimer/shared/permissions`, keyed by
the path Nest mounts the handler at.

The route half is deleted rather than rehoused. Those five paths are not routes
any app mounts: `apps/web` serves `/sessions`, `/sessions/new` and `/settings`,
`apps/admin-web` serves `/users` and `/roles`, and neither read the catalog —
both nav files write their rows out by hand. A list of one product's leftover
URLs does not earn a home in the platform kit both Vite apps compile. The rule
that survives is smaller: a gated nav row takes
`policies: ENDPOINT_POLICIES['/tokens']` where the row is declared, never a
literal rule list, and the route string stays in the app that mounts it.

The catalog also carries its own invariants now. `ENDPOINT_POLICIES` is typed
`Record<string, readonly [EndpointPolicy, ...EndpointPolicy[]]>`, so an empty
rule list and a misspelled member are both compile errors. `permissions/index.ts`
became a barrel over `abilities.ts` (a verbatim move of the old file) and
`endpoint-policies.ts`.
