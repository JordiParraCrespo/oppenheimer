import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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

  async findAllInOrganization(organizationId: string): Promise<AccessGrantEntity[]> {
    const records = await this.repository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
    return records.map((record) => this.mapper.toDomain(record));
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
      .andWhere(
        `(${principals
          .map(
            (_, index) =>
              `(grant.principalType = :type${index} AND grant.principalId = :id${index})`,
          )
          .join(' OR ')})`,
        Object.fromEntries(
          principals.flatMap((principal, index) => [
            [`type${index}`, principal.principalType],
            [`id${index}`, principal.principalId],
          ]),
        ),
      )
      .getMany();

    return records.map((record) => this.mapper.toDomain(record));
  }
}
