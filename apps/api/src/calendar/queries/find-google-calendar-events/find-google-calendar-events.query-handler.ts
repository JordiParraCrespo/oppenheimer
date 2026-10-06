import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import {
  CALENDAR_CONNECTION_REPOSITORY,
  CALENDAR_PROVIDER,
  TOKEN_SEALER,
} from '../../calendar.di-tokens';
import type { CalendarConnectionRepositoryPort } from '../../database/calendar-connection.repository.port';
import { CalendarErrors } from '../../domain/calendar.errors';
import type { CalendarConnectionEntity } from '../../domain/calendar-connection.entity';
import { isReadableRange } from '../../domain/calendar-range.policy';
import {
  CalendarGrantRevokedError,
  type CalendarProviderPort,
  type ProviderCalendarEvent,
} from '../../infrastructure/calendar-provider.port';
import type { TokenSealerPort } from '../../infrastructure/token-sealer.port';
import { FindGoogleCalendarEventsQuery } from './find-google-calendar-events.query';

/**
 * The caller's Google Calendar for a range of days, read through to Google
 * (`product/versions/mvp/20-plan-calendar.md` §5); nothing is stored. A grant
 * Google dropped, or one sealed under a key since replaced, marks the connection
 * revoked and answers `CALENDAR_007`, which the card turns into Reconnect.
 */
@QueryHandler(FindGoogleCalendarEventsQuery)
export class FindGoogleCalendarEventsQueryHandler
  implements IQueryHandler<FindGoogleCalendarEventsQuery, ProviderCalendarEvent[]>
{
  constructor(
    @Inject(CALENDAR_PROVIDER)
    private readonly provider: CalendarProviderPort,
    @Inject(TOKEN_SEALER)
    private readonly sealer: TokenSealerPort,
    @Inject(CALENDAR_CONNECTION_REPOSITORY)
    private readonly connections: CalendarConnectionRepositoryPort,
  ) {}

  async execute({ scope, range }: FindGoogleCalendarEventsQuery): Promise<ProviderCalendarEvent[]> {
    if (!isReadableRange(range.from, range.to)) {
      throw new AppError(CalendarErrors.RANGE_TOO_WIDE, { detail: `${range.from} to ${range.to}` });
    }
    if (!this.provider.isConfigured() || !this.sealer.isConfigured()) {
      throw new AppError(CalendarErrors.GOOGLE_NOT_CONFIGURED);
    }
    const found = await this.connections.findOwn(scope);
    if (found.isNone() || !found.unwrap().isActive) {
      throw new AppError(CalendarErrors.GOOGLE_NOT_CONNECTED);
    }
    const connection = found.unwrap();

    let refreshToken: string;
    try {
      refreshToken = this.sealer.open(connection.refreshTokenSealed);
    } catch {
      return this.revoked(connection, 'The grant was sealed under another key');
    }
    try {
      return await this.provider.listEvents(refreshToken, range);
    } catch (error) {
      if (error instanceof CalendarGrantRevokedError) {
        return this.revoked(connection, 'Google revoked the grant');
      }
      // Google's quota (`CALENDAR_010`): already the problem to answer.
      if (error instanceof AppError) throw error;
      throw new AppError(CalendarErrors.GOOGLE_UNAVAILABLE);
    }
  }

  private async revoked(connection: CalendarConnectionEntity, detail: string): Promise<never> {
    await this.connections.markRevoked(connection);
    throw new AppError(CalendarErrors.GOOGLE_NOT_CONNECTED, { detail });
  }
}
