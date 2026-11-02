import { permissionsKeys } from './permissions.keys';

/**
 * The consumer features whose reads reach the persisted query cache, beside
 * the kernel's own (`createQueryPersistOptions`). Only plain data belongs
 * here: a restore gives back plain JSON, so an entity (a session, a host, a
 * workspace: anything with a `Date` or a method) would come back broken, and
 * most features name someone's machines, repositories, code or day besides.
 * The permission catalog is neither: groups of scopes and what the caller may
 * grant. A consumer app passes this to `createQueryPersistOptions`.
 *
 * Anything else is not stored. One read inside a feature that is safe to keep
 * opts in where it is defined, with `meta: PERSIST_META` (the review period's
 * numbers on `useSuspensePullRequestAnalytics`: counts, medians, a lane mix
 * and dates, naming no repository and holding no code).
 */
export const CONSUMER_PERSISTED_FEATURES: readonly string[] = [permissionsKeys.all[0]];
