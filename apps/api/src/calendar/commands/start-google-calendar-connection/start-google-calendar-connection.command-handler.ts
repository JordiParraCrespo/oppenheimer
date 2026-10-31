import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireTenant } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { GoogleConnectStateResolver } from '../../application/google-connect-state.resolver';
import {
  CALENDAR_CONNECTION_REPOSITORY,
  CALENDAR_PROVIDER,
  TOKEN_SEALER,
} from '../../calendar.di-tokens';
import type { CalendarConnectionRepositoryPort } from '../../database/calendar-connection.repository.port';
import { CalendarErrors } from '../../domain/calendar.errors';
import { canConnectAnotherAccount } from '../../domain/calendar-accounts.policy';
import type { CalendarProviderPort } from '../../infrastructure/calendar-provider.port';
import type { TokenSealerPort } from '../../infrastructure/token-sealer.port';
import { StartGoogleCalendarConnectionCommand } from './start-google-calendar-connection.command';

export interface StartedGoogleConnection {
  url: string;
  expiresAt: Date;
}

/**
 * Starts connecting a Google account: a single-use state for this person in this
 * workspace, and Google's consent page carrying it, with the account chooser so
 * a second account can be picked. Reconnecting one of the caller's accounts
 * opens the chooser on its address; a new account past the fifth is refused
 * here, before Google is asked. More than an id comes back because the state is
 * about this request; no query can read it.
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
    @Inject(CALENDAR_CONNECTION_REPOSITORY)
    private readonly connections: CalendarConnectionRepositoryPort,
    private readonly states: GoogleConnectStateResolver,
  ) {}

  async execute({
    scope,
    input,
  }: StartGoogleCalendarConnectionCommand): Promise<StartedGoogleConnection> {
    requireTenant(scope);
    if (!this.provider.isConfigured() || !this.sealer.isConfigured()) {
      throw new AppError(CalendarErrors.GOOGLE_NOT_CONFIGURED);
    }
    const loginHint = await this.loginHint(scope, input.connectionId);
    const { state, expiresAt } = await this.states.mint(scope.userId, scope.organizationId);
    return { url: this.provider.authorizationUrl(state, loginHint), expiresAt };
  }

  /** The address to open Google's chooser on for a reconnect; none for a new account. */
  private async loginHint(
    scope: StartGoogleCalendarConnectionCommand['scope'],
    connectionId: string | undefined,
  ): Promise<string | undefined> {
    if (connectionId) {
      const found = await this.connections.findOwnById(scope, connectionId);
      if (found.isNone()) throw new AppError(CalendarErrors.GOOGLE_NOT_CONNECTED);
      return found.unwrap().accountEmail;
    }
    const held = await this.connections.findAllOwn(scope);
    if (!canConnectAnotherAccount(held.length)) {
      throw new AppError(CalendarErrors.GOOGLE_ACCOUNT_LIMIT_REACHED);
    }
    return undefined;
  }
}
