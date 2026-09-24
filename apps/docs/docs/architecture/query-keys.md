---
sidebar_position: 5
---

# React Query Keys

The frontend uses [TanStack Query](https://tanstack.com/query) for server
state. Query keys are the address of each cache entry — they decide what gets
deduplicated, refetched and invalidated. To keep them predictable we follow the
[Effective React Query Keys](https://tkdodo.eu/blog/effective-react-query-keys)
patterns from TkDodo (a TanStack Query maintainer).

This guide explains the rules and shows how to write a compliant **query key
factory**. The reference implementations live in
`packages/frontend/core/src/react/users.queries.ts` (lists, details, filters)
and `packages/frontend/consumer/src/react/installations.queries.ts` (resources
nested under a detail).

## The rules

### 1. Keys are arrays, and they come from a factory

A key is an array even when it has one entry, and nobody writes that array at
the call site: the feature's key factory (rule 4) builds it, so every key has a
name an invalidation can find it by.

```typescript
// ❌ avoid: a string, and an array literal nothing else can name
useQuery({ queryKey: 'users', queryFn: ... });
useQuery({ queryKey: ['users'], queryFn: ... });

// ✅ prefer
useQuery({ queryKey: usersKeys.list(params), queryFn: ... });
```

### 2. Structure keys from generic to specific

Order the entries in a key from the broadest scope to the narrowest. This
mirrors how React Query matches keys: a partial key fuzzy-matches every more
specific key beneath it.

```text
['users']                               everything users-related
['users', 'list']                       every list
['users', 'list', { search: 'jane' }]   one specific list
['users', 'detail']                     every detail
['users', 'detail', '42']               one specific detail
['users', 'detail', '42', 'sessions']   something that belongs to user 42
```

### 3. Colocate keys with their queries

Keep the key factory in the same feature file as the hooks that use it (e.g.
`users.queries.ts`), not in a single global `queryKeys.ts`. Related code stays
together and dead keys are easy to spot when a feature is deleted.

### 4. Use a query key factory

Expose a single object per feature that builds every key. Derive each level from
the one above it by **spreading**, so renaming the base key (or adding a scope)
propagates everywhere automatically.

## Anatomy of a factory

```typescript
export interface UsersListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: "admin" | "user";
}

export const usersKeys = {
  all: ["users"] as const,
  lists: () => [...usersKeys.all, "list"] as const,
  list: (params?: UsersListParams) => [...usersKeys.lists(), params] as const,
  details: () => [...usersKeys.all, "detail"] as const,
  detail: (id: string) => [...usersKeys.details(), id] as const,
  me: () => [...usersKeys.all, "me"] as const,
};
```

Notes:

- **`all`** is the single source of truth for the feature's namespace. Every
  other key spreads it, so there are no hardcoded `'users'` strings scattered
  around.
- **`lists()` / `details()`** are intermediate "scope" levels that take no
  arguments. They exist so you can invalidate _every_ list or _every_ detail in
  one call, regardless of the params/id.
- **`list(params)` / `detail(id)`** are the leaf keys passed to `useQuery`.
- Use `as const` everywhere so keys are inferred as readonly tuples — this gives
  you type-safe keys and autocompletion.

## Using the factory

```typescript
// Read a list
useQuery({
  queryKey: usersKeys.list(params),
  queryFn: () => app.users.findAll(...),
});

// Read a single user
useQuery({
  queryKey: usersKeys.detail(id),
  queryFn: () => app.users.findById(id),
});
```

## Invalidation patterns

Because keys are hierarchical, fuzzy matching lets you invalidate exactly the
scope you need:

```typescript
const queryClient = useQueryClient();

// Invalidate everything for the feature (lists, details, me, ...)
queryClient.invalidateQueries({ queryKey: usersKeys.all });

// Invalidate every list, but leave details untouched
queryClient.invalidateQueries({ queryKey: usersKeys.lists() });

// Invalidate a single detail
queryClient.invalidateQueries({ queryKey: usersKeys.detail(id) });
```

A mutation hook writes the entity the server answered with and invalidates
what it appears in — never `all`, which would mark the row just written stale
and fetch it again. The update goes through `withCacheOnSuccess` from
`@oppenheimer/frontend-core/react`, which runs it before the caller's
`onSuccess`; written inline beside `...options`, the spread order decides
whether it runs at all:

```typescript
export function useUpdateUser(options?: UpdateUserOptions) {
  return useMutation({
    mutationFn: ({ id, dto }) => app.users.update(id, dto),
    ...withCacheOnSuccess(options, (updated, { id }) => {
      queryClient.setQueryData(usersKeys.detail(id), updated);
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: usersKeys.me() });
    }),
  });
}
```

## What lint checks

Three of these rules are Biome plugins in `biome-plugins/`, matched on the
option properties rather than on a hook's name, so they hold for generic calls,
`useQueries` entries and every TanStack helper:

- `query-key-factory` — a `queryKey` that is an array literal, or a factory's
  `all` beside a `queryFn`.
- `mutation-on-success` — an `onSuccess` beside a `mutationFn`: use
  `withCacheOnSuccess`.
- `query-skip-token` — an `enabled` beside a `queryFn`: gate on `skipToken`.
  An `enabled` a caller passes into a wrapper hook is a condition, not a
  missing input, and is not checked.

Each has a fixture in `biome-plugins/fixtures/`, and `pnpm check:biome-plugins`
fails when a plugin stops flagging a bad case or starts flagging a good one.

## Pitfalls to avoid

- **Don't skip the scope segment.** Writing `detail: (id) => ['users', id]`
  drops the `'detail'` level. Besides breaking "invalidate all details", it can
  collide with sibling keys — e.g. `detail('me')` would equal the `me` key
  `['users', 'me']`. Always go through `details()`.
- **Don't hardcode the namespace.** `list: () => ['users', 'list']` won't pick
  up a rename of `all`. Spread instead: `[...usersKeys.lists()]`.
- **Don't share one global key file.** Colocate per feature.
- **Don't hand the root to `useQuery`.** `all` means "everything this feature
  caches"; the day a second query joins a feature whose only query was keyed
  `all`, invalidating `all` stops meaning what it did. Give the leaf its own
  segment: `capabilitiesKeys.deployment()`, not `capabilitiesKeys.all`.
- **Don't alias a key.** `export const profileQueryKey = usersKeys.me()` is a
  second name for the same entry that drifts the moment either side changes.
  Call the factory.
- **Nest what belongs to an entity under its `detail(id)`, and repeat the
  `list` / `detail` split below it.** An installation's repositories are
  `[...detail(id), 'repositories', 'list']`; one repository's branches are
  `[...detail(id), 'repositories', 'detail', repoId, 'branches']`. Removing the
  installation is one `removeQueries({ queryKey: installationsKeys.detail(id) })`,
  and refreshing its repository list does not refetch every branch, because a
  list leaf is never the prefix of a detail.
- **Every level is a function, and a sub-resource gets the same ladder.** A
  factory names every prefix anything may want to invalidate, so nobody
  hand-writes one. A resource inside a feature repeats `all → lists → list`,
  `details → detail` under its own name:

  ```typescript
  pairings: () => [...hostsKeys.all, 'pairing'] as const,
  pairingLists: () => [...hostsKeys.pairings(), 'list'] as const,
  pairingList: () => [...hostsKeys.pairingLists()] as const,
  pairingDetails: () => [...hostsKeys.pairings(), 'detail'] as const,
  pairingDetail: (name: string) => [...hostsKeys.pairingDetails(), name] as const,
  ```

  A level existing does not make it safe to invalidate. `pairingDetail`'s
  `queryFn` mints a token, so refreshing `pairings()` would mint again under
  the command on screen; the factory's comment says which level to use
  (`pairingLists()`), and the invalidation names that level.
- **Put every input of the `queryFn` in the key.** A variable the fetch reads
  but the key omits serves one answer for two questions. Several inputs go in
  an object at the end (`[...detail(id), 'start', { failed }]`), so order
  doesn't matter and fuzzy matching still works on the prefix.
- **An input that isn't known yet stays `undefined` in the key, and the fetch
  is `skipToken`.** `queryFn: id ? () => fetch(id) : skipToken`, with the
  factory taking `string | undefined`. Never `enabled: !!id` with a cast in the
  `queryFn`, and never a made-up id (`''`, `0`) in the key: it addresses a
  cache entry the API never issued, and two empty pickers share it.

## Cache persistence

The in-memory cache dies with the tab, so the app also writes it to
`localStorage` via TanStack's
[`PersistQueryClientProvider`](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient).
A reload renders from the restored cache and refetches in the
background instead of showing spinners.

The policy ships from `@oppenheimer/frontend-core/react` so it can
only drift in one place:

```typescript
import { CONSUMER_NON_PERSISTED_FEATURES } from '@oppenheimer/frontend-consumer/react';
import { createQueryPersistOptions, defaultQueryClientOptions } from '@oppenheimer/frontend-core/react';

const queryClient = new QueryClient({ defaultOptions: defaultQueryClientOptions(60_000) });

<PersistQueryClientProvider
  client={queryClient}
  persistOptions={{
    persister,
    ...createQueryPersistOptions(appVersion, {
      nonPersistedFeatures: CONSUMER_NON_PERSISTED_FEATURES,
    }),
  }}
>
```

What that policy encodes:

- **`maxAge` of 24h** — older entries are dropped on restore rather than
  hydrated, so nobody sees week-old data flash on screen.
- **`gcTime` ≥ `maxAge`** — a query garbage-collected from memory is never
  written to storage. Leaving `gcTime` at its 5-minute default would silently
  persist almost nothing, which is why `defaultQueryClientOptions` sets it.
- **`buster` = app version** — a release that changes a response shape starts
  from an empty cache instead of hydrating entries the new code misreads.
- **A per-feature deny-list** (`shouldDehydrateQuery`) — this is where the key
  convention pays off, since the first segment of every key names the feature:
  - `auth` is never persisted. The session query is `staleTime: Infinity`, so a
    restored entry would look fresh forever and `restoreSession()` would never
    run — the app would render as signed in with no session behind it.
  - `apiTokens` is never persisted — the consumer product names it in
    `CONSUMER_NON_PERSISTED_FEATURES`. Token prefixes, scopes and the
    permission catalog are credential metadata, and `localStorage` is not encrypted at rest.
  - Only **successful** queries are written; restoring an error or a pending
    fetch would replay a failure the user has already moved past.

Adding a feature whose data shouldn't outlive the session? Add its namespace to
`KERNEL_NON_PERSISTED_FEATURES` in
`packages/frontend/core/src/react/persistence.ts` when it is kernel data,
or to the product's own list — `CONSUMER_NON_PERSISTED_FEATURES` in
`packages/frontend/consumer/src/react/persistence.ts`, which the app passes
through `nonPersistedFeatures`.

## Whose cache is it?

Logging out clears everything — `useLogout` calls `queryClient.clear()` and the
persister writes the emptied cache back to storage — but a persisted cache can
still outlive the session it was written under: the session expires, an admin
revokes it, or the tab closes in the second before the persister's throttled
write lands. On a shared browser or device the next person would then see the
previous user's data hydrate before the refetch replaces it.

So the cache records who it belongs to. `useSessionRestore` calls
`reconcileCacheOwner()` inside its `queryFn` — before the query resolves, and
therefore before either app's gate renders anything:

```typescript
const userId = await app.auth.restoreSession(); // the signed-in user's id, or null
reconcileCacheOwner(queryClient, userId);
```

- Same user as the recorded owner → the cache is kept.
- Anyone else, **nobody** (no session), or **no owner recorded** (a cache
  written before the marker existed) → every non-`auth` query is removed and the
  new owner is recorded. `auth` is spared because the session query driving the
  call is one of them.

The owner marker is an ordinary query (`cacheOwnerKey`), so it is dehydrated and
restored alongside the cache it describes, and `queryClient.clear()` on logout
takes it with everything else.
