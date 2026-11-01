'use client';

import type { CloudAgentProviderId } from '@oppenheimer/shared/schemas/cloud-agent';

export const cloudAgentsKeys = {
  all: ['cloud-agents'] as const,
  status: () => [...cloudAgentsKeys.all, 'status'] as const,
  providers: () => [...cloudAgentsKeys.all, 'provider'] as const,
  provider: (provider: CloudAgentProviderId) => [...cloudAgentsKeys.providers(), provider] as const,
  models: (provider: CloudAgentProviderId) =>
    [...cloudAgentsKeys.provider(provider), 'models'] as const,
};
