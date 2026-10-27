import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { CloudAgentResolver, requireOrganization } from '../../application/cloud-agent.resolver';
import { CloudAgentMapper } from '../../cloud-agent.mapper';
import { CLOUD_AGENT_REPOSITORY } from '../../cloud-agents.di-tokens';
import type { CloudAgentRepositoryPort } from '../../database/cloud-agent.repository.port';
import { CloudAgentEntity } from '../../domain/cloud-agent.entity';
import { LaunchCloudAgentCommand } from './launch-cloud-agent.command';

/**
 * Starts a coding agent at the vendor the launch names, on the caller's own
 * key, and keeps what the vendor answered. The agent's id is chosen before
 * the vendor is asked and sent as the vendor's own (Cursor's `bc-<id>`), so
 * the row and the vendor's agent are one name. Nothing is stored when the
 * vendor refuses.
 */
@CommandHandler(LaunchCloudAgentCommand)
export class LaunchCloudAgentCommandHandler
  implements ICommandHandler<LaunchCloudAgentCommand, AggregateID>
{
  constructor(
    private readonly resolver: CloudAgentResolver,
    @Inject(CLOUD_AGENT_REPOSITORY) private readonly agents: CloudAgentRepositoryPort,
    private readonly mapper: CloudAgentMapper,
  ) {}

  async execute({ scope, input }: LaunchCloudAgentCommand): Promise<AggregateID> {
    const organizationId = requireOrganization(scope);
    const { provider, grant } = await this.resolver.callFor(scope, input.provider);
    const id = CloudAgentEntity.newId();
    const launch = this.mapper.toLaunch(id, input);
    const launched = await provider.launch(grant, launch);
    const agent = CloudAgentEntity.launched(
      this.mapper.toLaunchedProps(
        { id, organizationId, createdByUserId: scope.userId },
        launch,
        provider.id,
        launched,
      ),
      new Date(),
    );
    await this.agents.insert(agent);
    return agent.id;
  }
}
