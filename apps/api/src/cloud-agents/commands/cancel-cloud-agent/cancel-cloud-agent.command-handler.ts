import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { CloudAgentResolver } from '../../application/cloud-agent.resolver';
import { CLOUD_AGENT_REPOSITORY } from '../../cloud-agents.di-tokens';
import type { CloudAgentRepositoryPort } from '../../database/cloud-agent.repository.port';
import { CloudAgentErrors } from '../../domain/cloud-agents.errors';
import { CancelCloudAgentCommand } from './cancel-cloud-agent.command';

/**
 * Stops the latest run of one of the caller's agents. The agent stays, and a
 * follow-up starts it again. A run that already ended is the vendor's
 * `CLOUD_AGENTS_009`, and the agent is left as it is.
 */
@CommandHandler(CancelCloudAgentCommand)
export class CancelCloudAgentCommandHandler
  implements ICommandHandler<CancelCloudAgentCommand, AggregateID>
{
  constructor(
    private readonly resolver: CloudAgentResolver,
    @Inject(CLOUD_AGENT_REPOSITORY) private readonly agents: CloudAgentRepositoryPort,
  ) {}

  async execute({ scope, agentId }: CancelCloudAgentCommand): Promise<AggregateID> {
    const found = await this.agents.findOwnById(scope, agentId);
    if (found.isNone()) throw new AppError(CloudAgentErrors.NOT_FOUND);
    const agent = found.unwrap();
    const { provider, grant } = await this.resolver.callFor(scope, agent.provider);
    await provider.cancel(grant, agent.externalId, agent.latestRunId);
    agent.cancelled(new Date());
    await this.agents.save(agent);
    return agent.id;
  }
}
