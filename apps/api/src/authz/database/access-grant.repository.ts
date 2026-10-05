import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Paginated } from '@oppenheimer/backend-ddd';
import { None, type Option, Some } from 'oxide.ts';
import type { Repository } from 'typeorm';
import { AccessGrantMapper } from '../authz.mapper';
import type { AccessGrantEntity } from '../domain/access-grant.entity';
import { AccessGrantOrmEntity } from './access-grant.orm-entity';
import type { AccessGrantRepositoryPort } from './access-grant.repository.port';

@Injectable()
export class AccessGrantRepository implements AccessGrantRepositoryPort {
  constructor(
    @InjectRepository(AccessGrantOrmEntity)
    private readonly repository: Repository<AccessGrantOrmEntity>,
    private readonly mapper: AccessGrantMapper,
  ) {}

  async insert(entity: AccessGrantEntity): Promise<void> {
    await this.repository.insert(this.mapper.toPersistence(entity));
  }

  async findOneInOrganization(
    organizationId: string,
    id: string,
  ): Promise<Option<AccessGrantEntity>> {
    const record = await this.repository.findOneBy({ id, organizationId });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findPageInOrganization(
    organizationId: string,
    { page, limit }: { page: number; limit: number },
  ): Promise<Paginated<AccessGrantEntity>> {
    const [records, count] = await this.repository.findAndCount({
      where: { organizationId },
      // `id` breaks ties so a page boundary never repeats or skips a grant.
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return new Paginated({
      count,
      limit,
      page,
      data: records.map((record) => this.mapper.toDomain(record)),
    });
  }

  async delete(entity: AccessGrantEntity): Promise<boolean> {
    const result = await this.repository.delete({
      id: entity.id,
      organizationId: entity.organizationId,
    });
    return (result.affected ?? 0) > 0;
  }

  async findActiveForPrincipals(
    organizationId: string,
    principals: readonly { principalType: string; principalId: string }[],
  ): Promise<AccessGrantEntity[]> {
    if (principals.length === 0) return [];

    const records = await this.repository
      .createQueryBuilder('grant')
      .where('grant.organizationId = :organizationId', { organizationId })
      .andWhere('(grant.expiresAt IS NULL OR grant.expiresAt > now())')
      // One statement for any number of principals: the pairs travel as two
      // arrays, so the SQL text (and its plan-cache and pg_stat_statements
      // entry) does not change with how many teams and roles a user has.
      .andWhere(
        `(grant.principalType, grant.principalId) IN (
           SELECT * FROM unnest(CAST(:principalTypes AS varchar[]), CAST(:principalIds AS uuid[])))`,
        {
          principalTypes: principals.map((principal) => principal.principalType),
          principalIds: principals.map((principal) => principal.principalId),
        },
      )
      .getMany();

    return records.map((record) => this.mapper.toDomain(record));
  }
}
