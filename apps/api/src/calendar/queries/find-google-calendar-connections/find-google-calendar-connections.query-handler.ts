import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CALENDAR_CONNECTION_REPOSITORY } from '../../calendar.di-tokens';
import type { CalendarConnectionRepositoryPort } from '../../database/calendar-connection.repository.port';
import type { CalendarConnectionEntity } from '../../domain/calendar-connection.entity';
import { FindGoogleCalendarConnectionsQuery } from './find-google-calendar-connections.query';

/** The caller's own Google accounts, oldest first; none is an empty list, not an error. */
@QueryHandler(FindGoogleCalendarConnectionsQuery)
export class FindGoogleCalendarConnectionsQueryHandler
  implements IQueryHandler<FindGoogleCalendarConnectionsQuery, CalendarConnectionEntity[]>
{
  constructor(
    @Inject(CALENDAR_CONNECTION_REPOSITORY)
    private readonly connections: CalendarConnectionRepositoryPort,
  ) {}

  async execute({
    scope,
  }: FindGoogleCalendarConnectionsQuery): Promise<CalendarConnectionEntity[]> {
    return this.connections.findAllOwn(scope);
  }
}
