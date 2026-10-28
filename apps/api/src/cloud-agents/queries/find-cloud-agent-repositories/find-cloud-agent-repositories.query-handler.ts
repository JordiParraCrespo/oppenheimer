import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CloudAgentResolver } from '../../application/cloud-agent.resolver';
import { FindCloudAgentRepositoriesQuery } from './find-cloud-agent-repositories.query';

/** The repositories a vendor can reach for the caller, as URLs. */
@QueryHandler(FindCloudAgentRepositoriesQuery)
export class FindCloudAgentRepositoriesQueryHandler
  implements IQueryHandler<FindCloudAgentRepositoriesQuery, string[]>
{
  constructor(private readonly resolver: CloudAgentResolver) {}

  async execute({ scope, provider }: FindCloudAgentRepositoriesQuery): Promise<string[]> {
    const call = await this.resolver.callForNamed(scope, provider);
    return call.provider.repositories(call.grant);
  }
}
