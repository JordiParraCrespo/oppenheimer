import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { CLOUD_AGENT_REPOSITORY } from '../cloud-agents.di-tokens';
import type { CloudAgentRepositoryPort } from '../database/cloud-agent.repository.port';
import type { CloudAgentEntity } from '../domain/cloud-agent.entity';
import { CloudAgentResolver } from './cloud-agent.resolver';

/**
 * Asks the vendor about an agent's latest run and keeps the answer
 * (`domain/cloud-agent-sync.policy.ts` says when). A read never fails because
 * the vendor did: a rate limit, an outage or a key gone since leaves the agent
 * as it was last heard of, and its `syncedAt` says how long ago that was.
 */
@Injectable()
export class CloudAgentSyncResolver {
  private readonly logger = new Logger(CloudAgentSyncResolver.name);

  constructor(
    private readonly resolver: CloudAgentResolver,
    @Inject(CLOUD_AGENT_REPOSITORY) private readonly agents: CloudAgentRepositoryPort,
  ) {}

  async sync(scope: AccessScope, agent: CloudAgentEntity, now: Date): Promise<void> {
    try {
      const { provider, grant } = await this.resolver.callFor(scope, agent.provider);
      const run = await provider.read(grant, agent.externalId, agent.latestRunId);
      const runIdAtLoad = agent.latestRunId;
      agent.sync(run, now);
      // A follow-up that landed meanwhile moved the row on; this answer is about the run before it.
      await this.agents.saveIfRun(agent, runIdAtLoad);
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      this.logger.warn({
        message: 'A cloud agent could not be synced; showing what was last heard',
        agentId: agent.id,
        provider: agent.provider,
        code: error.code,
        detail: error.detail,
      });
    }
  }
}
