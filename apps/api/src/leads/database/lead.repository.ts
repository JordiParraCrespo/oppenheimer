import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import type { LeadEntity } from '../domain/lead.entity';
import { LeadMapper } from '../leads.mapper';
import { LeadResource } from '../leads.resource';
import { LeadOrmEntity } from './lead.orm-entity';
import type { LeadRepositoryPort } from './lead.repository.port';

/**
 * TypeORM adapter for the lead aggregate. Translates domain ↔ persistence via
 * `LeadMapper` and stages domain events on the transactional outbox atomically
 * with the write that raised them.
 *
 * Note what is absent from the reads: no `WHERE organizationId = ...`, no team
 * check, no ownership test. Extending `ScopedRepositoryBase` and naming the
 * resource is the whole of it — the predicate is generated from the same
 * declaration the CASL conditions use, so a query and an `ability.can()` cannot
 * disagree.
 */
@Injectable()
export class LeadRepository
  extends ScopedRepositoryBase<LeadOrmEntity>
  implements LeadRepositoryPort
{
  protected readonly resource = LeadResource;
  protected readonly alias = 'lead';

  constructor(
    @InjectRepository(LeadOrmEntity)
    protected readonly repository: Repository<LeadOrmEntity>,
    private readonly mapper: LeadMapper,
    private readonly outbox: OutboxService,
  ) {
    super();
  }

  async insert(entity: LeadEntity): Promise<void> {
    const record = this.mapper.toPersistence(entity);
    await this.outbox.writeWithEvents([entity], (manager) =>
      manager.getRepository(LeadOrmEntity).insert(record),
    );
  }

  async save(entity: LeadEntity): Promise<LeadEntity> {
    const record = await this.outbox.writeWithEvents([entity], (manager) =>
      manager.getRepository(LeadOrmEntity).save(this.mapper.toPersistence(entity)),
    );
    return this.mapper.toDomain(record);
  }

  async findAll(scope: AccessScope): Promise<LeadEntity[]> {
    const records = await this.scopedQuery(scope).orderBy('lead.createdAt', 'DESC').getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findOneById(scope: AccessScope, id: string): Promise<Option<LeadEntity>> {
    const record = await this.scopedQuery(scope).andWhere('lead.id = :id', { id }).getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async countAll(scope: AccessScope): Promise<number> {
    return this.scopedQuery(scope).getCount();
  }
}
