import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import { ScopedRepositoryBase } from '../../authz/database/scoped.repository';
import { type AccessScope } from '../../authz/domain/access-scope.types';
import { CalendarResource } from '../calendar.resource';
import { CalendarConnectionMapper } from '../calendar-connection.mapper';
import type { CalendarConnectionEntity } from '../domain/calendar-connection.entity';
import { CalendarConnectionOrmEntity } from './calendar-connection.orm-entity';
import type { CalendarConnectionRepositoryPort } from './calendar-connection.repository.port';

@Injectable()
export class CalendarConnectionRepository
  extends ScopedRepositoryBase<CalendarConnectionOrmEntity>
  implements CalendarConnectionRepositoryPort
{
  protected readonly resource = CalendarResource;
  protected readonly alias = 'connection';

  constructor(
    @InjectRepository(CalendarConnectionOrmEntity)
    protected readonly repository: Repository<CalendarConnectionOrmEntity>,
    private readonly mapper: CalendarConnectionMapper,
  ) {
    super();
  }

  async findAllOwn(scope: AccessScope): Promise<CalendarConnectionEntity[]> {
    const records = await this.ownQuery(scope)
      .orderBy('connection.createdAt', 'ASC')
      .addOrderBy('connection.id', 'ASC')
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findOwnById(scope: AccessScope, id: string): Promise<Option<CalendarConnectionEntity>> {
    const record = await this.ownQuery(scope).andWhere('connection.id = :id', { id }).getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async insert(connection: CalendarConnectionEntity): Promise<void> {
    await this.repository.insert(this.mapper.toPersistence(connection));
  }

  async save(connection: CalendarConnectionEntity): Promise<void> {
    const { id, organizationId, userId, ...changes } = this.mapper.toPersistence(connection);
    await this.repository.update({ id, organizationId, userId }, changes);
  }

  async markRevoked(connection: CalendarConnectionEntity): Promise<void> {
    await this.repository.update(
      { id: connection.id, organizationId: connection.organizationId },
      { status: 'revoked' },
    );
  }

  async fillSubject(connection: CalendarConnectionEntity, subject: string): Promise<void> {
    // Conditional on the row still being unkeyed and on no sibling holding the
    // subject, so a refresh racing a reconnect never trips the unique index.
    await this.repository.query(
      `UPDATE calendar_connection c SET "accountSubject" = $2
        WHERE c.id = $1 AND c."accountSubject" IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM calendar_connection other
             WHERE other."organizationId" = c."organizationId"
               AND other."userId" = c."userId"
               AND other.provider = c.provider
               AND other."accountSubject" = $2
          )`,
      [connection.id, subject],
    );
  }

  async delete(connection: CalendarConnectionEntity): Promise<void> {
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
    return this.scopedQuery(scope)
      .andWhere('connection.userId = :userId', { userId: scope.userId })
      .andWhere('connection.provider = :provider', { provider: 'google' });
  }
}
