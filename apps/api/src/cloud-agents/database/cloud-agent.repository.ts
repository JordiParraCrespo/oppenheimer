import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import { CloudAgentMapper } from '../cloud-agent.mapper';
import { CloudAgentResource } from '../cloud-agents.resource';
import type { CloudAgentEntity } from '../domain/cloud-agent.entity';
import { CloudAgentOrmEntity } from './cloud-agent.orm-entity';
import {
  CLOUD_AGENT_LIST_LIMIT,
  type CloudAgentRepositoryPort,
} from './cloud-agent.repository.port';

@Injectable()
export class CloudAgentRepository
  extends ScopedRepositoryBase<CloudAgentOrmEntity>
  implements CloudAgentRepositoryPort
{
  protected readonly resource = CloudAgentResource;
  protected readonly alias = 'agent';

  constructor(
    @InjectRepository(CloudAgentOrmEntity)
    protected readonly repository: Repository<CloudAgentOrmEntity>,
    private readonly mapper: CloudAgentMapper,
  ) {
    super();
  }

  async findOwn(scope: AccessScope): Promise<CloudAgentEntity[]> {
    // IDX_cloud_agent_owner serves the filter and the order.
    const records = await this.ownQuery(scope)
      .orderBy('agent.createdAt', 'DESC')
      .addOrderBy('agent.id', 'DESC')
      .limit(CLOUD_AGENT_LIST_LIMIT)
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findOwnById(scope: AccessScope, id: string): Promise<Option<CloudAgentEntity>> {
    const record = await this.ownQuery(scope).andWhere('agent.id = :id', { id }).getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async insert(agent: CloudAgentEntity): Promise<void> {
    await this.repository.insert(this.mapper.toPersistence(agent));
  }

  async save(agent: CloudAgentEntity): Promise<void> {
    const { id, organizationId, createdByUserId, ...changes } = this.mapper.toPersistence(agent);
    await this.repository.update({ id, organizationId, createdByUserId }, changes);
  }

  private ownQuery(scope: AccessScope) {
    return this.scopedQuery(scope).andWhere('agent.createdByUserId = :userId', {
      userId: scope.userId,
    });
  }
}
