import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { None, type Option, Some } from 'oxide.ts';
import { In, IsNull, Repository } from 'typeorm';
import { ScopedRepositoryBase } from '../../authz/database/scoped.repository';
import { type AccessScope } from '../../authz/domain/access-scope.types';
import type { GmailConnectionEntity } from '../domain/gmail-connection.entity';
import { GmailConnectionMapper } from '../gmail-connection.mapper';
import { MailResource } from '../mail.resource';
import { GmailConnectionOrmEntity } from './gmail-connection.orm-entity';
import type { GmailConnectionRepositoryPort } from './gmail-connection.repository.port';

@Injectable()
export class GmailConnectionRepository
  extends ScopedRepositoryBase<GmailConnectionOrmEntity>
  implements GmailConnectionRepositoryPort
{
  protected readonly resource = MailResource;
  protected readonly alias = 'connection';

  constructor(
    @InjectRepository(GmailConnectionOrmEntity)
    protected readonly repository: Repository<GmailConnectionOrmEntity>,
    private readonly mapper: GmailConnectionMapper,
  ) {
    super();
  }

  async findAllOwn(scope: AccessScope): Promise<GmailConnectionEntity[]> {
    const records = await this.ownQuery(scope)
      .orderBy('connection.createdAt', 'ASC')
      .addOrderBy('connection.id', 'ASC')
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findOwnById(scope: AccessScope, id: string): Promise<Option<GmailConnectionEntity>> {
    const record = await this.ownQuery(scope).andWhere('connection.id = :id', { id }).getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async insert(connection: GmailConnectionEntity): Promise<void> {
    await this.repository.insert(this.mapper.toPersistence(connection));
  }

  async save(connection: GmailConnectionEntity): Promise<void> {
    const { id, organizationId, userId, ...changes } = this.mapper.toPersistence(connection);
    await this.repository.update({ id, organizationId, userId }, changes);
  }

  async markHistory(connection: GmailConnectionEntity, historyId: string): Promise<boolean> {
    const result = await this.repository.update(
      {
        id: connection.id,
        organizationId: connection.organizationId,
        historyId: connection.historyId ?? IsNull(),
      },
      { historyId },
    );
    return result.affected === 1;
  }

  async findManyForSystem(ids: readonly string[]): Promise<GmailConnectionEntity[]> {
    if (ids.length === 0) return [];
    const records = await this.repository.findBy({ id: In([...ids]), status: 'active' });
    return records.map((record) => this.mapper.toDomain(record));
  }

  async markRevoked(connection: GmailConnectionEntity): Promise<void> {
    await this.repository.update(
      { id: connection.id, organizationId: connection.organizationId },
      { status: 'revoked' },
    );
  }

  async delete(connection: GmailConnectionEntity): Promise<void> {
    await this.repository.delete({
      id: connection.id,
      organizationId: connection.organizationId,
      userId: connection.userId,
    });
  }

  /**
   * The workspace clause is the scope's; the owner is this repository's, so
   * even a caller who can read every row of the workspace reads only their own.
   */
  private ownQuery(scope: AccessScope) {
    return this.scopedQuery(scope).andWhere('connection.userId = :userId', {
      userId: scope.userId,
    });
  }
}
