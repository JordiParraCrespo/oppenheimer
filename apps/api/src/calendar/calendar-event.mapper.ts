import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { CalendarEventOrmEntity } from './database/calendar-event.orm-entity';
import { CalendarEventEntity } from './domain/calendar-event.entity';
import { CalendarEventResponseDto } from './dtos/calendar-event.response.dto';
import type { ProviderCalendarEvent } from './infrastructure/calendar-provider.port';

@Injectable()
export class CalendarEventMapper
  implements Mapper<CalendarEventEntity, CalendarEventOrmEntity, CalendarEventResponseDto>
{
  toPersistence(entity: CalendarEventEntity): CalendarEventOrmEntity {
    const record = new CalendarEventOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.title = entity.title;
    record.notes = entity.notes;
    record.date = entity.date;
    record.allDay = entity.allDay;
    record.startTime = entity.startTime;
    record.endTime = entity.endTime;
    record.busy = entity.busy;
    record.createdByUserId = entity.createdByUserId;
    return record;
  }

  toDomain(record: CalendarEventOrmEntity): CalendarEventEntity {
    return CalendarEventEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        title: record.title,
        notes: record.notes ?? '',
        date: record.date,
        allDay: record.allDay,
        startTime: record.startTime ?? null,
        endTime: record.endTime ?? null,
        busy: record.busy,
        createdByUserId: record.createdByUserId ?? null,
      },
    });
  }

  toResponse(entity: CalendarEventEntity): CalendarEventResponseDto {
    const dto = new CalendarEventResponseDto();
    dto.id = entity.id;
    dto.source = 'personal';
    dto.title = entity.title;
    dto.notes = entity.notes;
    dto.date = entity.date;
    dto.allDay = entity.allDay;
    dto.startTime = entity.startTime;
    dto.endTime = entity.endTime;
    dto.busy = entity.busy;
    dto.url = null;
    return dto;
  }

  /** A provider's event in the same shape, read-only. */
  fromProvider(event: ProviderCalendarEvent): CalendarEventResponseDto {
    const dto = new CalendarEventResponseDto();
    dto.id = event.id;
    dto.source = 'google';
    dto.title = event.title;
    dto.notes = '';
    dto.date = event.date;
    dto.allDay = event.allDay;
    dto.startTime = event.startTime;
    dto.endTime = event.endTime;
    dto.busy = event.busy;
    dto.url = event.url;
    return dto;
  }
}
