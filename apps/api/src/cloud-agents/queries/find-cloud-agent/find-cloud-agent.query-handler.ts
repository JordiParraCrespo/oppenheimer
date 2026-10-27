import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { CloudAgentSyncResolver } from '../../application/cloud-agent-sync.resolver';
import { CLOUD_AGENT_REPOSITORY } from '../../cloud-agents.di-tokens';
import type { CloudAgentRepositoryPort } from '../../database/cloud-agent.repository.port';
import type { CloudAgentEntity } from '../../domain/cloud-agent.entity';
import { DETAIL_SYNC_AFTER_MS, needsSync } from '../../domain/cloud-agent-sync.policy';
import { CloudAgentErrors } from '../../domain/cloud-agents.errors';
import { FindCloudAgentQuery } from './find-cloud-agent.query';

/**
 * One of the caller's cloud agents, read through to the vendor while it
 * works and the last answer is older than `DETAIL_SYNC_AFTER_MS`. Someone
 * else's is not found.
 */
@QueryHandler(FindCloudAgentQuery)
export class FindCloudAgentQueryHandler
  implements IQueryHandler<FindCloudAgentQuery, CloudAgentEntity>
{
  constructor(
    @Inject(CLOUD_AGENT_REPOSITORY) private readonly agents: CloudAgentRepositoryPort,
    private readonly syncs: CloudAgentSyncResolver,
  ) {}

  async execute({ scope, id }: FindCloudAgentQuery): Promise<CloudAgentEntity> {
    const found = await this.agents.findOwnById(scope, id);
    if (found.isNone()) throw new AppError(CloudAgentErrors.NOT_FOUND);
    const agent = found.unwrap();
    const now = new Date();
    if (needsSync(agent, now, DETAIL_SYNC_AFTER_MS)) await this.syncs.sync(scope, agent, now);
    return agent;
  }
}
