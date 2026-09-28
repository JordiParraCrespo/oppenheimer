import { AppError, type SdkResult, unwrapBody } from '@oppenheimer/frontend-core';
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

/**
 * Client-side fallbacks for the consent call. `NO_REDIRECT` has its own
 * `errors.byCode` entry; `FAILED` reads as the screen's own fallback.
 */
export const ConsentErrors = {
  FAILED: { code: 'CONSENT_CLIENT_001', message: 'The consent could not be recorded' },
  NO_REDIRECT: { code: 'CONSENT_CLIENT_002', message: 'The consent answer carried no redirect' },
} as const;

/** The consent endpoint's answer, in the shape the generated SDK gives: it never throws. */
async function postConsent(
  accept: boolean,
  consentCode: string,
): Promise<SdkResult<{ redirectURI?: string }>> {
  try {
    const response = await fetch('/api/auth/oauth2/consent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accept, consent_code: consentCode }),
    });
    const body: unknown = await response.json().catch(() => undefined);
    return response.ok
      ? { data: body as { redirectURI?: string }, response }
      : { error: body ?? response.statusText, response };
  } catch (error) {
    return { error };
  }
}

/**
 * Post the reader's answer and return where the OAuth client wants them next.
 *
 * Better Auth's plugin endpoint is not on the generated client, so the call is
 * made here — and then unwrapped by the same `unwrapBody` every repository
 * uses, so its failures are `AppError`s the screen resolves by code: never the
 * server's English `message`, never a `TypeError`'s "Failed to fetch". A
 * request that got no answer keeps no status, which is what lets the resolver
 * say "could not reach the server" for exactly that case.
 */
export async function submitConsent(accept: boolean, consentCode: string): Promise<string> {
  const result = await postConsent(accept, consentCode);
  const body = await unwrapBody(result, ConsentErrors.FAILED);
  if (!body.redirectURI) {
    throw new AppError(ConsentErrors.NO_REDIRECT, { status: result.response?.status });
  }
  return body.redirectURI;
}
