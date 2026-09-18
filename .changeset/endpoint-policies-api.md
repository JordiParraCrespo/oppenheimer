---
"@oppenheimer/api": patch
---

Pin the controllers to `ENDPOINT_POLICIES` in
`auth/__tests__/endpoint-policies.spec.ts` (renamed from
`screen-policies.spec.ts`). `HANDLERS` is a `Record<GuardedEndpoint, …>`, so a
new catalog entry fails to compile until a handler is named for it.
