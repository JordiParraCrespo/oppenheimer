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
`packages/frontend/src/react/users.queries.ts` and `auth.queries.ts`.

## The rules

### 1. Always use arrays

Even when a key is a single string, write it as an array. React Query treats
string keys as `[key]` internally, so standardising on arrays keeps everything
consistent and composable.

```typescript
// ❌ avoid
useQuery({ queryKey: 'users', queryFn: ... });

// ✅ prefer
useQuery({ queryKey: ['users'], queryFn: ... });
```

### 2. Structure keys from generic to specific

Order the entries in a key from the broadest scope to the narrowest. This
mirrors how React Query matches keys: a partial key fuzzy-matches every more
specific key beneath it.

```typescript
["users"][("users", "list")][("users", "list", { search: "jane" })][ // everything users-related // every list // one specific list
  ("users", "detail")
][("users", "detail", "42")]; // every detail // one specific detail
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

A common optimistic-update pattern combines `setQueryData` for the entity you
already have with `invalidateQueries` for everything derived from it:

```typescript
useMutation({
  mutationFn: ({ id, dto }) => app.users.update(id, dto),
  onSuccess: (updated, { id }) => {
    // We already have the fresh entity — write it directly.
    queryClient.setQueryData(usersKeys.detail(id), updated);
    // Lists / me may now be stale — let them refetch.
    queryClient.invalidateQueries({ queryKey: usersKeys.all });
  },
});
```

## Pitfalls to avoid

- **Don't skip the scope segment.** Writing `detail: (id) => ['users', id]`
  drops the `'detail'` level. Besides breaking "invalidate all details", it can
  collide with sibling keys — e.g. `detail('me')` would equal the `me` key
  `['users', 'me']`. Always go through `details()`.
- **Don't hardcode the namespace.** `list: () => ['users', 'list']` won't pick
  up a rename of `all`. Spread instead: `[...usersKeys.lists()]`.
- **Don't share one global key file.** Colocate per feature.

## Cache persistence

The in-memory cache dies with the tab or the process, so both apps also write it
to storage — `localStorage` on web, `AsyncStorage` on mobile — via TanStack's
[`PersistQueryClientProvider`](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient).
A reload or a cold start renders from the restored cache and refetches in the
background instead of showing spinners.

The policy is shared by both apps from `@oppenheimer/frontend/react` so it can only
drift in one place:

```typescript
import { createQueryPersistOptions, defaultQueryClientOptions } from '@oppenheimer/frontend/react';

const queryClient = new QueryClient({ defaultOptions: defaultQueryClientOptions(60_000) });

<PersistQueryClientProvider
  client={queryClient}
  persistOptions={{ persister, ...createQueryPersistOptions(appVersion) }}
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
  - `apiTokens` is never persisted. Token prefixes, scopes and the permission
    catalog are credential metadata, and neither `localStorage` nor
    `AsyncStorage` is encrypted at rest. Tokens themselves live in
    `expo-secure-store` on mobile and never touch the query cache.
  - Only **successful** queries are written; restoring an error or a pending
    fetch would replay a failure the user has already moved past.

Adding a feature whose data shouldn't outlive the session? Add its namespace to
the non-persisted set in `packages/frontend/src/react/persistence.ts`.

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
