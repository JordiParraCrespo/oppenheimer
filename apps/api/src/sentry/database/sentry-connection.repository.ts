import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import type { SentryConnectionEntity } from '../domain/sentry-connection.entity';
import { SentryConnectionMapper } from '../sentry-connection.mapper';
import { SentryConnectionOrmEntity } from './sentry-connection.orm-entity';
import type { SentryConnectionRepositoryPort } from './sentry-connection.repository.port';

@Injectable()
export class SentryConnectionRepository implements SentryConnectionRepositoryPort {
  constructor(
    @InjectRepository(SentryConnectionOrmEntity)
    private readonly repository: Repository<SentryConnectionOrmEntity>,
    private readonly mapper: SentryConnectionMapper,
  ) {}

  async findForOrganization(organizationId: string): Promise<Option<SentryConnectionEntity>> {
    const record = await this.repository.findOne({ where: { organizationId } });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findById(id: string): Promise<Option<SentryConnectionEntity>> {
    const record = await this.repository.findOne({ where: { id } });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async put(connection: SentryConnectionEntity): Promise<SentryConnectionEntity> {
    // One per workspace: a second replaces the first's slug and secret and
    // keeps its id, so the webhook URL already in Sentry stays right.
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(SentryConnectionOrmEntity)
      .values(this.mapper.toPersistence(connection))
      .orUpdate(
        ['organizationSlug', 'sealedClientSecret', 'secretHint', 'createdByUserId', 'updatedAt'],
        ['organizationId'],
      )
      .execute();
    const stored = await this.repository.findOneOrFail({
      where: { organizationId: connection.organizationId },
    });
    return this.mapper.toDomain(stored);
  }

  async deleteForOrganization(organizationId: string): Promise<boolean> {
    const result = await this.repository.delete({ organizationId });
    return (result.affected ?? 0) > 0;
  }
}
