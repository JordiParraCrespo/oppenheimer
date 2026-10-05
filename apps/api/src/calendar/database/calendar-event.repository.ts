import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import { CalendarResource } from '../calendar.resource';
import { CalendarEventMapper } from '../calendar-event.mapper';
import type { CalendarEventEntity } from '../domain/calendar-event.entity';
import { CalendarEventOrmEntity } from './calendar-event.orm-entity';
import type { CalendarEventRepositoryPort } from './calendar-event.repository.port';

@Injectable()
export class CalendarEventRepository
  extends ScopedRepositoryBase<CalendarEventOrmEntity>
  implements CalendarEventRepositoryPort
{
  protected readonly resource = CalendarResource;
  protected readonly alias = 'event';

  constructor(
    @InjectRepository(CalendarEventOrmEntity)
    protected readonly repository: Repository<CalendarEventOrmEntity>,
    private readonly mapper: CalendarEventMapper,
  ) {
    super();
  }

  async findInRange(
    scope: AccessScope,
    range: { from: string; to: string },
  ): Promise<CalendarEventEntity[]> {
    const records = await this.scopedQuery(scope)
      .andWhere('event.date BETWEEN :from AND :to', range)
      .orderBy('event.date')
      .addOrderBy('event.startTime', 'ASC', 'NULLS FIRST')
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findOneById(scope: AccessScope, id: string): Promise<Option<CalendarEventEntity>> {
    const record = await this.scopedQuery(scope).andWhere('event.id = :id', { id }).getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async insert(event: CalendarEventEntity): Promise<void> {
    await this.repository.insert(this.mapper.toPersistence(event));
  }

  async save(event: CalendarEventEntity): Promise<void> {
    const { id, organizationId, createdByUserId, ...fields } = this.mapper.toPersistence(event);
    await this.repository.update({ id, organizationId }, fields);
  }

  async delete(event: CalendarEventEntity): Promise<void> {
    await this.repository.delete({ id: event.id, organizationId: event.organizationId });
  }
}
