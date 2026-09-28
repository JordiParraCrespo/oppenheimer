import { AppError, toAppError } from '@oppenheimer/frontend-core';
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

/** Client-side fallbacks for the consent call; the screen words them. */
export const ConsentErrors = {
  FAILED: { code: 'CONSENT_CLIENT_001', message: 'The consent could not be recorded' },
  NO_REDIRECT: { code: 'CONSENT_CLIENT_002', message: 'The consent answer carried no redirect' },
} as const;

/**
 * Post the reader's answer and return where the OAuth client wants them next.
 *
 * Every failure rejects as an `AppError`, the way a repository's would, so the
 * screen resolves it into the reader's language by its code — never the
 * server's English `message`, and never a `TypeError`'s "Failed to fetch". A
 * request that got no answer keeps no status, which is what lets the resolver
 * say "could not reach the server" for exactly that case.
 */
export async function submitConsent(accept: boolean, consentCode: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch('/api/auth/oauth2/consent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accept, consent_code: consentCode }),
    });
  } catch (cause) {
    throw toAppError(cause, ConsentErrors.FAILED);
  }

  const body = (await response.json().catch(() => undefined)) as
    | { redirectURI?: string; code?: unknown }
    | undefined;
  if (!response.ok) {
    throw toAppError({ status: response.status, body, code: body?.code }, ConsentErrors.FAILED);
  }
  if (!body?.redirectURI) {
    throw new AppError(ConsentErrors.NO_REDIRECT, { status: response.status });
  }
  return body.redirectURI;
}
