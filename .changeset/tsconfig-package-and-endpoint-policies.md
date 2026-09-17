---
"@oppenheimer/tsconfig": minor
"@oppenheimer/shared": minor
"@oppenheimer/api": patch
"@oppenheimer/web": patch
"@oppenheimer/admin-web": patch
"@oppenheimer/frontend-web": patch
---

Name the config package after what it holds, and put the endpoint policies next
to CASL.

`@oppenheimer/config` is now `@oppenheimer/tsconfig`, in `packages/tsconfig/`. "Config" said
nothing — the repo has seven other things that answer to it (`src/config/` in
the API, `ShellConfig`, `vite.config.ts`, the root `.env`) — while the package
holds tsconfig presets and the two build-time helpers that travel with them
(`vite-chunks.mjs`, `depcruise/*.cjs`). Every `extends`, devDependency,
Dockerfile `COPY` and doc reference moved with it; nothing else changed.

`@oppenheimer/shared` no longer exports `./navigation`. `SCREENS` paired a web route
(`/team`, `/api-tokens`) with the endpoint behind it and the rules that endpoint
demands. The endpoint half is a real contract and stays, as `ENDPOINT_POLICIES`
in `@oppenheimer/shared/permissions` — keyed by the path Nest mounts the handler at,
which is what `apps/api/src/auth/__tests__/endpoint-policies.spec.ts` (renamed
from `screen-policies.spec.ts`) pins the controllers to.

The route half is deleted rather than rehoused. Those five paths are not routes
any app mounts: `apps/web` serves `/sessions`, `/sessions/new` and `/settings`,
`apps/admin-web` serves `/users` and `/roles`, and neither read the catalog —
both nav files write their rows out by hand. A list
of one product's leftover URLs does not earn a home in the platform kit both
Vite apps compile. The rule that survives is smaller and is now what the docs
say: a gated nav row takes `policies: ENDPOINT_POLICIES['/tokens']` where the
row is declared, never a literal rule list, and the route string stays in the
app that mounts it.

The catalog also carries its own invariants now. `ENDPOINT_POLICIES` is typed
`Record<string, readonly [EndpointPolicy, ...EndpointPolicy[]]>`, so an empty
rule list and a misspelled member are both compile errors — which is what the
package-local spec was asserting at runtime, so it is gone. `HANDLERS` in the
API test is a `Record<GuardedEndpoint, …>`, so a new catalog entry fails to
compile until a handler is named for it. Nothing casts.

`permissions/index.ts` became a barrel over `abilities.ts` (a verbatim move of
the old file) and `endpoint-policies.ts`.
