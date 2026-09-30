import { Inject, Injectable } from '@nestjs/common';
import { toResourceScope } from '@oppenheimer/shared';
import type { CredentialResolverPort } from '../../auth/application/credential-resolver.port';
import type { ScopeContext } from '../../auth/domain/scope-context.types';
import { HOST_ASSERTION } from '../hosts.di-tokens';
import type { HostAssertionPort } from './host-assertion.port';

/**
 * The boot assertion a runner signs with the key it registered, presented as an
 * ordinary `Authorization: Bearer` because the protocol says so
 * (`product/versions/mvp/03-control-plane.md`). Parsing and verifying stay behind
 * {@link HostAssertionPort}.
 *
 * It yields a credential with no owner and no scopes: `ScopesGuard` refuses it on
 * every route declaring a scope, and the one route a machine calls about itself says
 * `@AllowAnyScope()`, since a machine holds no permission.
 */
@Injectable()
export class HostCredentialResolver implements CredentialResolverPort {
  readonly kind = 'host';

  /**
   * Every boot assertion carries a `jti` burned on first use, so a digest of
   * one names a single request. The rate limiter buckets by the resolved
   * `host:<id>` instead — the machine, however many assertions it mints.
   */
  readonly singleUse = true;

  constructor(
    @Inject(HOST_ASSERTION)
    private readonly assertions: HostAssertionPort,
  ) {}

  /**
   * A compact JWS whose header says `EdDSA`, which neither an API token nor a
   * Better Auth session token can be — so claiming the string takes nothing away
   * from the other kinds.
   */
  recognises(presented: string): boolean {
    return this.assertions.recognises(presented);
  }

  /**
   * A refusal throws the port's opaque rejection, never a `null`: a string this
   * resolver claimed must not fall through to another kind or to the session
   * path.
   */
  async resolve(presented: string): Promise<ScopeContext> {
    const { hostId, expiresAt } = await this.assertions.verify(presented);

    return {
      kind: this.kind,
      // There is no token record to name, so the host is the identity — which is
      // also the right rate-limit bucket for a machine that reconnects.
      credentialId: `host:${hostId}`,
      hostId,
      scopes: [],
      // A machine is not restricted to an organization: it belongs to a person,
      // and what may run on it is decided by `HostAccessPort`, not by a scope.
      resourceScope: toResourceScope(null),
      expiresAt,
    };
  }
}
