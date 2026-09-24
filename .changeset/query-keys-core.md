---
"@oppenheimer/frontend-core": minor
---

Query keys follow the Effective React Query Keys rules throughout: `capabilitiesKeys.deployment()` replaces the root as the capabilities query's key, and the `profileQueryKey` alias is gone (use `usersKeys.me()`). `useLogin`, `useLogout`, `useUpdateUser` and `useDeleteUser` no longer let a caller's `onSuccess` replace their cache update, so logout clears the cache again.
