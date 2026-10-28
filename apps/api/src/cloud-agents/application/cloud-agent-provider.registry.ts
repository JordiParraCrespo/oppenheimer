import type { CloudAgentProviderId } from '@oppenheimer/shared';
import type { CloudAgentProvider } from './cloud-agent-provider.port';

/**
 * The cloud agent vendors this deployment knows, in the order the console
 * lists them. The list is built once, in `cloud-agents.module.ts`; it is the
 * one place a vendor is added.
 */
export class CloudAgentProviderRegistry {
  constructor(private readonly providers: readonly CloudAgentProvider[]) {
    const ids = providers.map((provider) => provider.id);
    if (new Set(ids).size !== ids.length) {
      throw new Error(`Two cloud agent providers share an id: ${ids.join(', ')}`);
    }
  }

  /** Every provider, in order. */
  all(): readonly CloudAgentProvider[] {
    return this.providers;
  }

  /** The provider with `id`; undefined for one this deployment does not have. */
  get(id: CloudAgentProviderId): CloudAgentProvider | undefined {
    return this.providers.find((provider) => provider.id === id);
  }

  /** The ids the caller can launch on now, in order. */
  async availableFor(organizationId: string, userId: string): Promise<CloudAgentProviderId[]> {
    const answers = await Promise.all(
      this.providers.map((provider) => provider.availableFor(organizationId, userId)),
    );
    return this.providers.filter((_, index) => answers[index]).map((provider) => provider.id);
  }
}
