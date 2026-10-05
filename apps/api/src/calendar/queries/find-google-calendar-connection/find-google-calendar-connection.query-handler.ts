import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CALENDAR_CONNECTION_REPOSITORY } from '../../calendar.di-tokens';
import type { CalendarConnectionRepositoryPort } from '../../database/calendar-connection.repository.port';
import type { CalendarConnectionEntity } from '../../domain/calendar-connection.entity';
import { FindGoogleCalendarConnectionQuery } from './find-google-calendar-connection.query';

/** The caller's own connection, or null: not having one is not an error. */
@QueryHandler(FindGoogleCalendarConnectionQuery)
export class FindGoogleCalendarConnectionQueryHandler
  implements IQueryHandler<FindGoogleCalendarConnectionQuery, CalendarConnectionEntity | null>
{
  constructor(
    @Inject(CALENDAR_CONNECTION_REPOSITORY)
    private readonly connections: CalendarConnectionRepositoryPort,
  ) {}

  async execute({
    scope,
  }: FindGoogleCalendarConnectionQuery): Promise<CalendarConnectionEntity | null> {
    const found = await this.connections.findOwn(scope);
    return found.isSome() ? found.unwrap() : null;
  }
}
