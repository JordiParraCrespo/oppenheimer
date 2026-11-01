'use client';

/**
 * Query keys for the signed-in user's own account.
 *
 * No id anywhere: every endpoint under `/profile` acts on whoever the
 * credential belongs to. Signing in as somebody else has to clear this subtree
 * rather than fetch a different key — `reconcileCacheOwner` already does that
 * for the whole cache.
 */
export const profileKeys = {
  all: ['profile'] as const,
  me: () => [...profileKeys.all, 'me'] as const,
  sessions: () => [...profileKeys.all, 'sessions'] as const,
};
