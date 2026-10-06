import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { GoogleConnectStateResolver } from '../../application/google-connect-state.resolver';
import { CALENDAR_PROVIDER, TOKEN_SEALER } from '../../calendar.di-tokens';
import { CalendarErrors } from '../../domain/calendar.errors';
import type { CalendarProviderPort } from '../../infrastructure/calendar-provider.port';
import type { TokenSealerPort } from '../../infrastructure/token-sealer.port';
import { StartGoogleCalendarConnectionCommand } from './start-google-calendar-connection.command';

export interface StartedGoogleConnection {
  url: string;
  expiresAt: Date;
}

/**
 * Starts Connect Google Calendar: a single-use state for this person in this
 * workspace, and Google's consent page carrying it. More than an id comes back
 * because the state is about this request; no query can read it.
 */
@CommandHandler(StartGoogleCalendarConnectionCommand)
export class StartGoogleCalendarConnectionCommandHandler
  implements ICommandHandler<StartGoogleCalendarConnectionCommand, StartedGoogleConnection>
{
  constructor(
    @Inject(CALENDAR_PROVIDER)
    private readonly provider: CalendarProviderPort,
    @Inject(TOKEN_SEALER)
    private readonly sealer: TokenSealerPort,
    private readonly states: GoogleConnectStateResolver,
  ) {}

  async execute({ scope }: StartGoogleCalendarConnectionCommand): Promise<StartedGoogleConnection> {
    if (!scope.organizationId) throw new AppError(CalendarErrors.NO_ACTIVE_ORGANIZATION);
    if (!this.provider.isConfigured() || !this.sealer.isConfigured()) {
      throw new AppError(CalendarErrors.GOOGLE_NOT_CONFIGURED);
    }
    const { state, expiresAt } = await this.states.mint(scope.userId, scope.organizationId);
    return { url: this.provider.authorizationUrl(state), expiresAt };
  }
}
