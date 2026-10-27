import { Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { type CloudAgentProviderId, cloudAgentProviderSchema } from '@oppenheimer/shared';
import { CloudAgentErrors } from '../domain/cloud-agents.errors';
import type { CloudAgentProvider } from './cloud-agent-provider.port';
import { CloudAgentProviderRegistry } from './cloud-agent-provider.registry';

/** A provider and the caller's grant for it: what one verb needs. */
export interface ProviderCall<G = unknown> {
  provider: CloudAgentProvider<G>;
  grant: G;
}

/**
 * Who a cloud agent call goes to. Unlike dictation's walk there is no
 * fallback, by design: a cloud agent lives at the vendor it was launched on,
 * and a launch names its vendor, so the one provider is the answer or the
 * call fails. When the caller holds no key for it, `CLOUD_AGENTS_004`.
 */
@Injectable()
export class CloudAgentResolver {
  constructor(private readonly registry: CloudAgentProviderRegistry) {}

  async callFor(scope: AccessScope, id: CloudAgentProviderId): Promise<ProviderCall> {
    return this.callForOwner(
      { organizationId: requireOrganization(scope), userId: scope.userId },
      id,
    );
  }

  /** {@link callFor} on a named person's key in a workspace: whose a session's agent is. */
  async callForOwner(
    owner: { organizationId: string; userId: string },
    id: CloudAgentProviderId,
  ): Promise<ProviderCall> {
    const provider = this.registry.get(id);
    if (!provider || !(await provider.availableFor(owner.organizationId, owner.userId))) {
      throw new AppError(CloudAgentErrors.NOT_CONNECTED, { detail: `No ${id} key is stored` });
    }
    return { provider, grant: await provider.grantFor(owner.organizationId, owner.userId) };
  }

  /** The provider a route's `:provider` names, to identify a key before it is stored. */
  providerFor(value: string): CloudAgentProvider {
    const parsed = cloudAgentProviderSchema.safeParse(value);
    const provider = parsed.success ? this.registry.get(parsed.data) : undefined;
    if (!provider) {
      throw new AppError(CloudAgentErrors.PROVIDER_NOT_FOUND, {
        detail: `${value} is not a cloud agent provider`,
      });
    }
    return provider;
  }

  /** {@link callFor} for a route's `:provider`. */
  callForNamed(scope: AccessScope, value: string): Promise<ProviderCall> {
    return this.callFor(scope, this.providerFor(value).id);
  }
}

export function requireOrganization(scope: AccessScope): string {
  if (!scope.organizationId) throw new AppError(CloudAgentErrors.NO_ACTIVE_ORGANIZATION);
  return scope.organizationId;
}
