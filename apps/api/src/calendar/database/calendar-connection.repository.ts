import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
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

  async findOwn(scope: AccessScope): Promise<Option<CalendarConnectionEntity>> {
    // The workspace clause is the scope's; the owner is this repository's, so
    // even a caller who can read every row of the workspace reads only their own.
    const record = await this.scopedQuery(scope)
      .andWhere('connection.userId = :userId', { userId: scope.userId })
      .andWhere('connection.provider = :provider', { provider: 'google' })
      .getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async upsert(connection: CalendarConnectionEntity): Promise<void> {
    const record = this.mapper.toPersistence(connection);
    await this.repository.upsert(record, {
      conflictPaths: ['organizationId', 'userId', 'provider'],
    });
  }

  async markRevoked(connection: CalendarConnectionEntity): Promise<void> {
    await this.repository.update(
      { organizationId: connection.organizationId, userId: connection.userId },
      { status: 'revoked' },
    );
  }

  async delete(connection: CalendarConnectionEntity): Promise<void> {
    await this.repository.delete({
      organizationId: connection.organizationId,
      userId: connection.userId,
      provider: connection.provider,
    });
  }
}
