import { Inject, Injectable } from '@nestjs/common';
import { toResourceScope } from '@oppenheimer/shared';
import type { CredentialResolverPort } from '../../auth/application/credential-resolver.port';
import type { ScopeContext } from '../../auth/domain/scope-context.types';
import { HOST_ASSERTION } from '../hosts.di-tokens';
import type { HostAssertionPort } from './host-assertion.port';

/**
 * This module's contribution to the auth kernel: the boot assertion a runner
 * signs with the key it registered, presented as an ordinary
 * `Authorization: Bearer` because that is what the protocol says it is
 * (`product/versions/mvp/03-control-plane.md`).
 *
 * The kernel recognises no machine credential of its own — it asks every
 * registered resolver whether a presented string is theirs — so "what shape a
 * host assertion has" and "which host signed this one" both stay knowledge of
 * this module. Verification is reached through {@link HostAssertionPort}, the
 * same port the rest of the module injects, which means the signature, the
 * audience, the expiry and the replay guard are decided in one place and refused
 * with one answer.
 *
 * What comes back is a credential with no owner and no scopes. That is all the
 * guards need: `ScopesGuard` refuses it on every route that declares a scope by
 * the rule it already had, and the one route a machine calls about itself says
 * `@AllowAnyScope()` because there is no permission for a machine to hold.
 */
@Injectable()
export class HostCredentialResolver implements CredentialResolverPort {
  readonly kind = 'host';

  constructor(
    @Inject(HOST_ASSERTION)
    private readonly assertions: HostAssertionPort,
  ) {}

  /**
   * A compact JWS whose header says `EdDSA`, which neither an API token nor a
   * Better Auth session token can be — so claiming the string takes nothing away
   * from the other kinds. Recognising is not verifying: it only says this
   * resolver is the right one to ask next.
   */
  recognises(presented: string): boolean {
    return this.assertions.recognises(presented);
  }

  /**
   * Verify the assertion and describe what it authorizes. A refusal throws this
   * module's opaque rejection from the port, never a `null`: a string this
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
