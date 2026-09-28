import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { Injectable, Logger } from '@nestjs/common';
import { describeError } from '@oppenheimer/backend-core';
import { APIError } from 'better-auth/api';
import { parseCookies } from 'better-auth/cookies';
import { auth } from './better-auth.config';
import { asRecord, betterAuthHeaders } from './better-auth.util';
import type {
  CredentialVerifierPort,
  VerifiedOAuthGrant,
  VerifiedSession,
} from './credential-verifier.port';

/** Length of a base64 HMAC-SHA256, as Better Auth signs its cookies. */
const COOKIE_SIGNATURE_LENGTH = 44;

/**
 * {@link CredentialVerifierPort} against Better Auth.
 *
 * The only place that names `auth.api.getMcpSession` / `getSession`. "Not this
 * kind of credential" arrives as a `null` or a rejected `APIError`, and is
 * folded into the `null` the caller branches on; a failure of Better Auth
 * itself (a 5xx, an unreachable store) is not a verdict about the credential
 * and propagates.
 */
@Injectable()
export class BetterAuthCredentialVerifierAdapter implements CredentialVerifierPort {
  private readonly logger = new Logger(BetterAuthCredentialVerifierAdapter.name);

  async verifyOAuthGrant(headers: IncomingHttpHeaders): Promise<VerifiedOAuthGrant | null> {
    const session = await auth.api
      .getMcpSession({ headers: betterAuthHeaders(headers) })
      .catch((error: unknown) => {
        this.logger.debug(`OAuth token verification failed: ${describeError(error)}`);
        return null;
      });

    if (!session?.userId) return null;

    return {
      userId: session.userId,
      accessToken: session.accessToken,
      scopes: session.scopes,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
    };
  }

  async verifySession(headers: IncomingHttpHeaders): Promise<VerifiedSession | null> {
    try {
      const found = await auth.api.getSession({ headers: betterAuthHeaders(headers) });
      return found ? (found as unknown as VerifiedSession) : null;
    } catch (error) {
      if (error instanceof APIError && Number(asRecord(error).statusCode) < 500) return null;
      throw error;
    }
  }

  async signedSessionCookie(headers: IncomingHttpHeaders): Promise<string | null> {
    const header = headers.cookie;
    if (!header) return null;

    const context = await auth.$context;
    const raw = parseCookies(header).get(context.authCookies.sessionToken.name);
    if (!raw) return null;

    const value = safeDecode(raw);
    const dot = value.lastIndexOf('.');
    if (dot < 1) return null;
    const token = value.slice(0, dot);
    const signature = value.slice(dot + 1);
    if (signature.length !== COOKIE_SIGNATURE_LENGTH) return null;

    // The same HMAC Better Auth signs the cookie with (better-call's
    // `signCookieValue`), compared in constant time.
    const expected = createHmac('sha256', context.secret).update(token, 'utf8').digest('base64');
    const given = Buffer.from(signature);
    const wanted = Buffer.from(expected);
    return given.length === wanted.length && timingSafeEqual(given, wanted) ? token : null;
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
