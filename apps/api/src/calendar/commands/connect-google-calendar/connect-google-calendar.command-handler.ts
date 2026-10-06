import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { GoogleConnectStateResolver } from '../../application/google-connect-state.resolver';
import {
  CALENDAR_CONNECTION_REPOSITORY,
  CALENDAR_PROVIDER,
  TOKEN_SEALER,
} from '../../calendar.di-tokens';
import type { CalendarConnectionRepositoryPort } from '../../database/calendar-connection.repository.port';
import { CalendarErrors } from '../../domain/calendar.errors';
import { CalendarConnectionEntity } from '../../domain/calendar-connection.entity';
import {
  type CalendarGrant,
  type CalendarProviderPort,
  GOOGLE_CALENDAR_SCOPE,
} from '../../infrastructure/calendar-provider.port';
import type { TokenSealerPort } from '../../infrastructure/token-sealer.port';
import { ConnectGoogleCalendarCommand } from './connect-google-calendar.command';

/**
 * Finishes Connect Google Calendar: the state is spent first, so a stolen redirect
 * cannot be replayed, then the code is exchanged once. A grant without a refresh
 * token or without the calendar permission is refused rather than stored, and a
 * new grant replaces the person's old one.
 */
@CommandHandler(ConnectGoogleCalendarCommand)
export class ConnectGoogleCalendarCommandHandler
  implements ICommandHandler<ConnectGoogleCalendarCommand, AggregateID>
{
  constructor(
    @Inject(CALENDAR_PROVIDER)
    private readonly provider: CalendarProviderPort,
    @Inject(TOKEN_SEALER)
    private readonly sealer: TokenSealerPort,
    @Inject(CALENDAR_CONNECTION_REPOSITORY)
    private readonly connections: CalendarConnectionRepositoryPort,
    private readonly states: GoogleConnectStateResolver,
  ) {}

  async execute({ scope, input }: ConnectGoogleCalendarCommand): Promise<AggregateID> {
    if (!scope.organizationId) throw new AppError(CalendarErrors.NO_ACTIVE_ORGANIZATION);
    if (!this.provider.isConfigured() || !this.sealer.isConfigured()) {
      throw new AppError(CalendarErrors.GOOGLE_NOT_CONFIGURED);
    }
    await this.states.redeem(input.state, scope.userId, scope.organizationId);

    const grant = await this.exchange(input.code);
    if (!grant.refreshToken || !grant.scopes.includes(GOOGLE_CALENDAR_SCOPE)) {
      throw new AppError(CalendarErrors.GOOGLE_GRANT_REFUSED, {
        detail: grant.refreshToken
          ? 'The calendar permission was not granted'
          : 'Google returned no refresh token',
      });
    }
    const connection = CalendarConnectionEntity.connect({
      organizationId: scope.organizationId,
      userId: scope.userId,
      accountEmail: grant.accountEmail,
      refreshTokenSealed: this.sealer.seal(grant.refreshToken),
      scopes: grant.scopes,
    });
    await this.connections.upsert(connection);
    return connection.id;
  }

  private async exchange(code: string): Promise<CalendarGrant> {
    try {
      return await this.provider.exchange(code);
    } catch (error) {
      // Google's quota (`CALENDAR_010`) is not a refused code.
      if (error instanceof AppError) throw error;
      throw new AppError(CalendarErrors.GOOGLE_GRANT_REFUSED, {
        detail: 'Google refused the authorization code',
      });
    }
  }
}
