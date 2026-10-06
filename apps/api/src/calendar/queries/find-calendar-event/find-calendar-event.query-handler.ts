import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import { CALENDAR_EVENT_REPOSITORY } from '../../calendar.di-tokens';
import type { CalendarEventRepositoryPort } from '../../database/calendar-event.repository.port';
import { CalendarErrors } from '../../domain/calendar.errors';
import type { CalendarEventEntity } from '../../domain/calendar-event.entity';
import { FindCalendarEventQuery } from './find-calendar-event.query';

/** No route of its own: the event writes read their answer back through it. */
@QueryHandler(FindCalendarEventQuery)
export class FindCalendarEventQueryHandler
  implements IQueryHandler<FindCalendarEventQuery, CalendarEventEntity>
{
  constructor(
    @Inject(CALENDAR_EVENT_REPOSITORY)
    private readonly events: CalendarEventRepositoryPort,
  ) {}

  async execute({ scope, eventId }: FindCalendarEventQuery): Promise<CalendarEventEntity> {
    return requireFound(
      await this.events.findOneById(scope, eventId),
      CalendarErrors.EVENT_NOT_FOUND,
      {
        detail: `No event with id ${eventId}`,
      },
    );
  }
}
