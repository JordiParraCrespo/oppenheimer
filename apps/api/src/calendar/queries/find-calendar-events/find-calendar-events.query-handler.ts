import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { CALENDAR_EVENT_REPOSITORY } from '../../calendar.di-tokens';
import type { CalendarEventRepositoryPort } from '../../database/calendar-event.repository.port';
import { CalendarErrors } from '../../domain/calendar.errors';
import type { CalendarEventEntity } from '../../domain/calendar-event.entity';
import { isReadableRange } from '../../domain/calendar-range.policy';
import { FindCalendarEventsQuery } from './find-calendar-events.query';

@QueryHandler(FindCalendarEventsQuery)
export class FindCalendarEventsQueryHandler
  implements IQueryHandler<FindCalendarEventsQuery, CalendarEventEntity[]>
{
  constructor(
    @Inject(CALENDAR_EVENT_REPOSITORY)
    private readonly events: CalendarEventRepositoryPort,
  ) {}

  async execute({ scope, from, to }: FindCalendarEventsQuery): Promise<CalendarEventEntity[]> {
    if (!isReadableRange(from, to)) {
      throw new AppError(CalendarErrors.RANGE_TOO_WIDE, { detail: `${from} to ${to}` });
    }
    return this.events.findInRange(scope, { from, to });
  }
}
