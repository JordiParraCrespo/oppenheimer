import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { CloudAgentResolver } from '../../application/cloud-agent.resolver';
import { CLOUD_AGENT_REPOSITORY } from '../../cloud-agents.di-tokens';
import type { CloudAgentRepositoryPort } from '../../database/cloud-agent.repository.port';
import { CloudAgentErrors } from '../../domain/cloud-agents.errors';
import { FollowUpCloudAgentCommand } from './follow-up-cloud-agent.command';

/**
 * The next instruction for one of the caller's agents: a new run at the
 * vendor. The vendor refuses one while a run is still going
 * (`CLOUD_AGENTS_008`); this does not check first, since only the vendor
 * knows whether its run ended a second ago.
 */
@CommandHandler(FollowUpCloudAgentCommand)
export class FollowUpCloudAgentCommandHandler
  implements ICommandHandler<FollowUpCloudAgentCommand, AggregateID>
{
  constructor(
    private readonly resolver: CloudAgentResolver,
    @Inject(CLOUD_AGENT_REPOSITORY) private readonly agents: CloudAgentRepositoryPort,
  ) {}

  async execute({ scope, agentId, prompt }: FollowUpCloudAgentCommand): Promise<AggregateID> {
    const found = await this.agents.findOwnById(scope, agentId);
    if (found.isNone()) throw new AppError(CloudAgentErrors.NOT_FOUND);
    const agent = found.unwrap();
    const { provider, grant } = await this.resolver.callFor(scope, agent.provider);
    const runIdAtLoad = agent.latestRunId;
    const runId = await provider.followUp(grant, agent.externalId, prompt);
    agent.followedUp(runId, new Date());
    // Lost only to a second follow-up, whose newer run the vendor already refused this one for.
    await this.agents.saveIfRun(agent, runIdAtLoad);
    return agent.id;
  }
}
