import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import type { CloudAgentProviderId } from '@oppenheimer/shared';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import { CloudAgentCredentialMapper } from '../cloud-agent-credential.mapper';
import { CloudAgentResource } from '../cloud-agents.resource';
import type { CloudAgentCredentialEntity } from '../domain/cloud-agent-credential.entity';
import { CloudAgentCredentialOrmEntity } from './cloud-agent-credential.orm-entity';
import type { CloudAgentCredentialRepositoryPort } from './cloud-agent-credential.repository.port';

@Injectable()
export class CloudAgentCredentialRepository
  extends ScopedRepositoryBase<CloudAgentCredentialOrmEntity>
  implements CloudAgentCredentialRepositoryPort
{
  protected readonly resource = CloudAgentResource;
  protected readonly alias = 'credential';

  constructor(
    @InjectRepository(CloudAgentCredentialOrmEntity)
    protected readonly repository: Repository<CloudAgentCredentialOrmEntity>,
    private readonly mapper: CloudAgentCredentialMapper,
  ) {
    super();
  }

  async findAllOwn(scope: AccessScope): Promise<CloudAgentCredentialEntity[]> {
    const records = await this.ownQuery(scope).orderBy('credential.provider', 'ASC').getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findFor(
    organizationId: string,
    userId: string,
    provider: CloudAgentProviderId,
  ): Promise<Option<CloudAgentCredentialEntity>> {
    const record = await this.repository.findOne({ where: { organizationId, userId, provider } });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async put(credential: CloudAgentCredentialEntity): Promise<void> {
    // UQ_cloud_agent_credential_user_provider: a second key replaces the first.
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(CloudAgentCredentialOrmEntity)
      .values(this.mapper.toPersistence(credential))
      .orUpdate(
        ['sealedKey', 'keyHint', 'keyName', 'accountEmail', 'accountId', 'updatedAt'],
        ['organizationId', 'userId', 'provider'],
      )
      .execute();
  }

  async deleteOwn(scope: AccessScope, provider: CloudAgentProviderId): Promise<boolean> {
    if (!scope.organizationId) return false;
    const result = await this.repository.delete({
      organizationId: scope.organizationId,
      userId: scope.userId,
      provider,
    });
    return (result.affected ?? 0) > 0;
  }

  /**
   * The workspace clause is the scope's; the holder is this repository's, so
   * even a caller who can read every row of the workspace reads only their own.
   */
  private ownQuery(scope: AccessScope) {
    return this.scopedQuery(scope).andWhere('credential.userId = :userId', {
      userId: scope.userId,
    });
  }
}
