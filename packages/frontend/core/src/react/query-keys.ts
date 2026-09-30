export const userSettingsKeys = {
  all: ['userSettings'] as const,
  me: () => [...userSettingsKeys.all, 'me'] as const,
};

/**
 * Defined here rather than in `auth.queries.ts` because `persistence.ts` needs
 * it at module load, and `auth.queries.ts` imports `persistence.ts`: keeping it
 * here breaks the cycle. Every key is derived from `all` so the whole subtree
 * can be invalidated or cleared with a single key.
 */
export const authKeys = {
  all: ['auth'] as const,
  session: () => [...authKeys.all, 'session'] as const,
};
