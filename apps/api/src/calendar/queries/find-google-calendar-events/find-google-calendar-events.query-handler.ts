import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { GoogleCalendarAccountReadStatus } from '@oppenheimer/shared';
import {
  CALENDAR_CONNECTION_REPOSITORY,
  CALENDAR_PROVIDER,
  TOKEN_SEALER,
} from '../../calendar.di-tokens';
import type { ConnectionCalendarEvent } from '../../calendar-event.mapper';
import type { CalendarConnectionRepositoryPort } from '../../database/calendar-connection.repository.port';
import { CalendarErrors } from '../../domain/calendar.errors';
import type { CalendarConnectionEntity } from '../../domain/calendar-connection.entity';
import { dropDuplicateEvents } from '../../domain/calendar-event-dedupe.policy';
import { isReadableRange } from '../../domain/calendar-range.policy';
import {
  CalendarGrantRevokedError,
  type CalendarProviderPort,
} from '../../infrastructure/calendar-provider.port';
import type { TokenSealerPort } from '../../infrastructure/token-sealer.port';
import { FindGoogleCalendarEventsQuery } from './find-google-calendar-events.query';

export interface GoogleCalendarEventsRead {
  events: ConnectionCalendarEvent[];
  accounts: { id: string; status: GoogleCalendarAccountReadStatus }[];
}

interface AccountRead {
  id: string;
  status: GoogleCalendarAccountReadStatus;
  events: ConnectionCalendarEvent[];
  limited?: AppError; // Google's quota problem: the answer when every account hit it
}

/**
 * Every Google account of the caller's for a range of days, read in parallel and
 * never stored (`23-plan-milestones-stats-accounts.md` §5); a meeting two accounts
 * hold is drawn once. A failing account marks only itself: a dropped or unsealable
 * grant marks its row revoked, anything else is `error`. Only a quota that stopped
 * every account answers `CALENDAR_010`, so the console waits as asked.
 */
@QueryHandler(FindGoogleCalendarEventsQuery)
export class FindGoogleCalendarEventsQueryHandler
  implements IQueryHandler<FindGoogleCalendarEventsQuery, GoogleCalendarEventsRead>
{
  constructor(
    @Inject(CALENDAR_PROVIDER)
    private readonly provider: CalendarProviderPort,
    @Inject(TOKEN_SEALER)
    private readonly sealer: TokenSealerPort,
    @Inject(CALENDAR_CONNECTION_REPOSITORY)
    private readonly connections: CalendarConnectionRepositoryPort,
  ) {}

  async execute({
    scope,
    range,
  }: FindGoogleCalendarEventsQuery): Promise<GoogleCalendarEventsRead> {
    if (!isReadableRange(range.from, range.to)) {
      throw new AppError(CalendarErrors.RANGE_TOO_WIDE, { detail: `${range.from} to ${range.to}` });
    }
    if (!this.provider.isConfigured() || !this.sealer.isConfigured()) {
      throw new AppError(CalendarErrors.GOOGLE_NOT_CONFIGURED);
    }
    const owned = await this.connections.findAllOwn(scope);
    const reads = await Promise.all(owned.map((connection) => this.read(connection, range)));

    const reached = reads.filter((read) => read.status !== 'revoked');
    const limited = reached.flatMap((read) => (read.limited ? [read.limited] : []));
    if (reached.length > 0 && limited.length === reached.length) throw limited[0];

    return {
      events: dropDuplicateEvents(
        reads.flatMap((read) => read.events),
        ({ event }) => event.dedupeKey,
      ),
      accounts: reads.map(({ id, status }) => ({ id, status })),
    };
  }

  private async read(
    connection: CalendarConnectionEntity,
    range: FindGoogleCalendarEventsQuery['range'],
  ): Promise<AccountRead> {
    const id = connection.id;
    if (!connection.isActive) return { id, status: 'revoked', events: [] };
    let refreshToken: string;
    try {
      refreshToken = this.sealer.open(connection.refreshTokenSealed);
    } catch {
      // Sealed under a key since replaced: only a new grant reads it again.
      await this.connections.markRevoked(connection);
      return { id, status: 'revoked', events: [] };
    }
    try {
      const read = await this.provider.listEvents({ connectionId: id, refreshToken }, range);
      if (connection.accountSubject === null && read.account) {
        await this.connections.fillSubject(connection, read.account.subject).catch(() => undefined);
      }
      return {
        id,
        status: 'ok',
        events: read.events.map((event) => ({ connectionId: id, event })),
      };
    } catch (error) {
      if (error instanceof CalendarGrantRevokedError) {
        await this.connections.markRevoked(connection);
        return { id, status: 'revoked', events: [] };
      }
      return {
        id,
        status: 'error',
        events: [],
        limited: error instanceof AppError ? error : undefined,
      };
    }
  }
}
