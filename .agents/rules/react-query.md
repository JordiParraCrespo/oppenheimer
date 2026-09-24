---
paths:
  - "packages/frontend/*/src/react/**/*"
  - "apps/web/src/features/**/hooks/**/*"
  - "apps/docs/docs/architecture/query-keys.md"
---

# React Query Rules

Query hooks live in `packages/frontend/{core,consumer}/src/react/<module>.queries.ts`,
next to the module's key factory. The guide with the reasoning and examples is
[`apps/docs/docs/architecture/query-keys.md`](../../apps/docs/docs/architecture/query-keys.md);
this page is what an agent needs while writing one. Three rules are checked by
Biome plugins in `biome-plugins/`, and they fail `pnpm lint` and CI:

| Plugin | Forbids | Write instead |
| --- | --- | --- |
| `mutation-on-success.grit` (`src/react/**`) | an inline `onSuccess` in `useMutation` | `...withCacheOnSuccess(options, update)` |
| `query-key-factory.grit` | `queryKey: ['x']` or `queryKey: thingsKeys.all` in a query | a leaf from the factory: `thingsKeys.detail(id)` |
| `query-skip-token.grit` | `enabled: !!x` / `enabled: Boolean(x)` in a query | `queryFn: x ? () => fetch(x) : skipToken` |

## Keys

- One factory per module, `thingsKeys`, every level spread from `all`:
  `lists()` → `list(filters)`, `details()` → `detail(id)`. `all` is never a
  query's key; it is only ever invalidated or removed.
- What belongs to one entity hangs off its `detail(id)`, and repeats the
  `list` / `detail` split below it — never an id straight after `all`, where
  `'list'` sits.
- Two keys share a prefix only when invalidating one must refetch the other.
  A factory level is an invitation to invalidate it: `hostsKeys.currentPairing()`
  mints and `hostsKeys.pairingTokens()` polls, so they have no parent.
- Every input the `queryFn` reads is in the key; several go in an object at
  the end. An input not known yet is `undefined` in the key, never `''` or `0`.
- No aliases (`export const profileQueryKey = usersKeys.me()`); call the factory.
- Changing the shape of a key in a persisted feature bumps
  `QUERY_PERSIST_REVISION` in `core/src/react/persistence.ts`, or the old entry
  sits in storage for a day that nothing reads.

## Mutations

- The hook's cache update goes through `withCacheOnSuccess` from
  `@oppenheimer/frontend-core/react`. It runs the update, awaits it, then the
  caller's `onSuccess`, so the caller cannot replace it.
- Write what the server answered (`setQueryData(detail(id), saved)`) and
  invalidate what it appears in (`lists()`, `me()`). Never invalidate `all`
  over a row just written: that marks it stale and fetches it again.
- A delete removes `detail(id)` rather than invalidating it.

## Tests

Assert a key as its exact tuple. Ask what an invalidation reaches of a real
`QueryClient` (seed with `setQueryData`, invalidate, read
`getQueryState(key)?.isInvalidated`) — never a homemade prefix matcher. A
mutation hook's spec passes a caller `onSuccess` and checks the cache update
still happened.
