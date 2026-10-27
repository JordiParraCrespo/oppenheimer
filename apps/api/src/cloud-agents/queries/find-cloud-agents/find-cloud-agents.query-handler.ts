import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CloudAgentSyncResolver } from '../../application/cloud-agent-sync.resolver';
import { CLOUD_AGENT_REPOSITORY } from '../../cloud-agents.di-tokens';
import type { CloudAgentRepositoryPort } from '../../database/cloud-agent.repository.port';
import type { CloudAgentEntity } from '../../domain/cloud-agent.entity';
import { agentsToSync } from '../../domain/cloud-agent-sync.policy';
import { FindCloudAgentsQuery } from './find-cloud-agents.query';

/**
 * The caller's newest cloud agents, newest first. Before answering, the few
 * working agents heard from longest ago are asked about again
 * (`agentsToSync`), so a list kept open moves without costing a vendor call
 * per row.
 */
@QueryHandler(FindCloudAgentsQuery)
export class FindCloudAgentsQueryHandler
  implements IQueryHandler<FindCloudAgentsQuery, CloudAgentEntity[]>
{
  constructor(
    @Inject(CLOUD_AGENT_REPOSITORY) private readonly agents: CloudAgentRepositoryPort,
    private readonly syncs: CloudAgentSyncResolver,
  ) {}

  async execute({ scope }: FindCloudAgentsQuery): Promise<CloudAgentEntity[]> {
    const agents = await this.agents.findOwn(scope);
    const now = new Date();
    await Promise.all(agentsToSync(agents, now).map((agent) => this.syncs.sync(scope, agent, now)));
    return agents;
  }
}
