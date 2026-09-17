import type { PermissionGroup, Scope } from '@oppenheimer/shared';

export interface ConsentSearch {
  consent_code?: string;
  client_id?: string;
  scope?: string;
}

/**
 * Match the requested scope string against the catalog. Anything the catalog
 * does not describe is surfaced verbatim rather than dropped, so a client
 * asking for something unrecognised cannot slip it past the user.
 */
export function describeScopes(
  scope: string | undefined,
  groups: readonly PermissionGroup[],
): {
  scopes: { group: PermissionGroup; level: 'read' | 'write' }[];
  unknown: string[];
} {
  const requested = new Set(
    (scope ?? '')
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean),
  );

  const matched: { group: PermissionGroup; level: 'read' | 'write' }[] = [];
  for (const group of groups) {
    for (const level of ['read', 'write'] as const) {
      const value: Scope = group.levels[level].scope;
      if (requested.has(value)) {
        matched.push({ group, level });
        requested.delete(value);
      }
    }
  }

  return { scopes: matched, unknown: [...requested] };
}

export async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? `Request failed with ${response.status}`;
  } catch {
    return `Request failed with ${response.status}`;
  }
}
