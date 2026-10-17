/**
 * The one `meta` the persistence policy reads: a read inside a denied feature
 * that is safe to keep anyway says so with `meta: PERSIST_META`. Every opt-in
 * goes through this constant, so they are one search away and the policy has
 * one shape to honour; a second kind of exception gets its own field here.
 */
export const PERSIST_META = { persist: true } as const;

export type QueryPersistMeta = typeof PERSIST_META;
