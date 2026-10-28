import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CloudAgentResolver } from '../../application/cloud-agent.resolver';
import type { CloudAgentModel } from '../../application/cloud-agent-provider.port';
import { FindCloudAgentModelsQuery } from './find-cloud-agent-models.query';

/** The models a vendor offers the caller, its own default left out: a launch names no model for it. */
@QueryHandler(FindCloudAgentModelsQuery)
export class FindCloudAgentModelsQueryHandler
  implements IQueryHandler<FindCloudAgentModelsQuery, CloudAgentModel[]>
{
  constructor(private readonly resolver: CloudAgentResolver) {}

  async execute({ scope, provider }: FindCloudAgentModelsQuery): Promise<CloudAgentModel[]> {
    const call = await this.resolver.callForNamed(scope, provider);
    return call.provider.models(call.grant);
  }
}
