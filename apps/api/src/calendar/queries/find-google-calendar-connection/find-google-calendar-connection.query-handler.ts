import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { CALENDAR_CONNECTION_REPOSITORY } from '../../calendar.di-tokens';
import type { CalendarConnectionRepositoryPort } from '../../database/calendar-connection.repository.port';
import { CalendarErrors } from '../../domain/calendar.errors';
import type { CalendarConnectionEntity } from '../../domain/calendar-connection.entity';
import { FindGoogleCalendarConnectionQuery } from './find-google-calendar-connection.query';

/** One of the caller's own Google accounts; someone else's, or none, is `CALENDAR_007`. */
@QueryHandler(FindGoogleCalendarConnectionQuery)
export class FindGoogleCalendarConnectionQueryHandler
  implements IQueryHandler<FindGoogleCalendarConnectionQuery, CalendarConnectionEntity>
{
  constructor(
    @Inject(CALENDAR_CONNECTION_REPOSITORY)
    private readonly connections: CalendarConnectionRepositoryPort,
  ) {}

  async execute({
    scope,
    id,
  }: FindGoogleCalendarConnectionQuery): Promise<CalendarConnectionEntity> {
    const found = await this.connections.findOwnById(scope, id);
    if (found.isNone()) throw new AppError(CalendarErrors.GOOGLE_NOT_CONNECTED);
    return found.unwrap();
  }
}
