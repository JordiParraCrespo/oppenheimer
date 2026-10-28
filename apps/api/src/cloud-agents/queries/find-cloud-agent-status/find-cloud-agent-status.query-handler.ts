import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { requireOrganization } from '../../application/cloud-agent.resolver';
import { CloudAgentProviderRegistry } from '../../application/cloud-agent-provider.registry';
import { CloudAgentCredentialMapper } from '../../cloud-agent-credential.mapper';
import { CLOUD_AGENT_CREDENTIAL_REPOSITORY, KEY_SEALER } from '../../cloud-agents.di-tokens';
import type { CloudAgentCredentialRepositoryPort } from '../../database/cloud-agent-credential.repository.port';
import type { CloudAgentStatusResponseDto } from '../../dtos/cloud-agent-status.response.dto';
import type { KeySealerPort } from '../../infrastructure/key-sealer.port';
import { FindCloudAgentStatusQuery } from './find-cloud-agent-status.query';

/**
 * Whether the caller can launch a cloud agent, and on which vendors: every
 * provider is asked `availableFor` (a row and a config read, never the
 * vendor), and a connected one is described from its stored credential.
 */
@QueryHandler(FindCloudAgentStatusQuery)
export class FindCloudAgentStatusQueryHandler
  implements IQueryHandler<FindCloudAgentStatusQuery, CloudAgentStatusResponseDto>
{
  constructor(
    private readonly registry: CloudAgentProviderRegistry,
    @Inject(CLOUD_AGENT_CREDENTIAL_REPOSITORY)
    private readonly credentials: CloudAgentCredentialRepositoryPort,
    @Inject(KEY_SEALER) private readonly sealer: KeySealerPort,
    private readonly mapper: CloudAgentCredentialMapper,
  ) {}

  async execute({ scope }: FindCloudAgentStatusQuery): Promise<CloudAgentStatusResponseDto> {
    const organizationId = requireOrganization(scope);
    const [available, credentials] = await Promise.all([
      this.registry.availableFor(organizationId, scope.userId),
      this.credentials.findAllOwn(scope),
    ]);
    return this.mapper.toStatus(
      credentials.filter((row) => available.includes(row.provider)),
      this.sealer.isConfigured(),
    );
  }
}
