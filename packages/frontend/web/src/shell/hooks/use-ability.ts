import { useMyPermissions } from '@oppenheimer/frontend-core/react';
import { type AppAbility, defineAbilitiesFromPermissions } from '@oppenheimer/shared/permissions';
import { useMemo } from 'react';

export interface AbilityState {
  /** The ability, or `undefined` while it is unknown — loading or unavailable. */
  ability: AppAbility | undefined;
  /**
   * The permission set could not be fetched — the query failed and has no
   * cached answer to fall back on. Distinct from "still loading", because the
   * two want opposite treatment: a caller waits out the first and must not
   * wait out the second, which never resolves.
   */
  isUnavailable: boolean;
}

/**
 * The signed-in user's CASL ability, rebuilt in the browser from the effective
 * permissions the API serves (`GET /users/me/permissions`). This is the same
 * union of roles the server's `PoliciesGuard` checks, so a `can(...)` here
 * agrees with what the API would allow — it lets the UI hide what it would only
 * be refused, rather than showing it and rendering the 403.
 *
 * Imported from the `@oppenheimer/shared/permissions` subpath, never the package
 * root — the root's CJS build is not tree-shakeable and would drag the whole
 * shared graph into the bundle (see the repo-root `AGENTS.md`).
 */
export function useAbilityState(): AbilityState {
  const { data: permissions, isError } = useMyPermissions();

  return useMemo(
    () => ({
      ability: permissions ? defineAbilitiesFromPermissions(permissions) : undefined,
      isUnavailable: !permissions && isError,
    }),
    [permissions, isError],
  );
}

/** {@link useAbilityState} for callers that only need the ability itself. */
export function useAbility(): AppAbility | undefined {
  return useAbilityState().ability;
}
