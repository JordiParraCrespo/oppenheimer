import type { IncomingHttpHeaders } from 'node:http';
import { Injectable, Logger } from '@nestjs/common';
import { auth } from './better-auth.config';
import { betterAuthHeaders } from './better-auth.util';
import type { CredentialVerifierPort, VerifiedOAuthGrant } from './credential-verifier.port';

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * {@link CredentialVerifierPort} against Better Auth.
 *
 * The only place that names `auth.api.getMcpSession` / `getSession`. Both calls
 * answer "not this kind of credential" by rejecting, which is not an error
 * worth propagating — a request may carry no OAuth grant and no session at all
 * — so each is folded into a `null`/`false` the caller can branch on.
 */
@Injectable()
export class BetterAuthCredentialVerifierAdapter implements CredentialVerifierPort {
  private readonly logger = new Logger(BetterAuthCredentialVerifierAdapter.name);

  async verifyOAuthGrant(headers: IncomingHttpHeaders): Promise<VerifiedOAuthGrant | null> {
    const session = await auth.api
      .getMcpSession({ headers: betterAuthHeaders(headers) })
      .catch((error: unknown) => {
        this.logger.debug(`OAuth token verification failed: ${describe(error)}`);
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

  async hasValidSession(headers: IncomingHttpHeaders): Promise<boolean> {
    const session = await auth.api
      .getSession({ headers: betterAuthHeaders(headers) })
      .catch(() => null);
    return session !== null;
  }
}
