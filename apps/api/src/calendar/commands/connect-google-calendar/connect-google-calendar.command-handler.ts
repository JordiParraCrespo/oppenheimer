import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireTenant } from '@oppenheimer/backend-authz';
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
import { canConnectAnotherAccount, nextColorIndex } from '../../domain/calendar-accounts.policy';
import {
  CalendarConnectionEntity,
  type CalendarGrantProps,
} from '../../domain/calendar-connection.entity';
import {
  type CalendarGrant,
  type CalendarProviderPort,
  GOOGLE_CALENDAR_SCOPE,
} from '../../infrastructure/calendar-provider.port';
import type { TokenSealerPort } from '../../infrastructure/token-sealer.port';
import { ConnectGoogleCalendarCommand } from './connect-google-calendar.command';

/**
 * Finishes connecting a Google account: the state is spent first, so a stolen
 * redirect cannot be replayed, then the code is exchanged once. A grant without
 * a refresh token, without the calendar permission or without an ID token
 * (which says which account it is) is refused rather than stored.
 *
 * An account the person already connected is reconnected in place, keeping its
 * colour: matched by Google's `sub`, or, for a row kept before subjects were,
 * by its address, which keys that row. Any other account is a new connection,
 * up to five, in the lowest colour none of the person's others holds.
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
    requireTenant(scope);
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
    if (!grant.account) {
      throw new AppError(CalendarErrors.GOOGLE_GRANT_REFUSED, {
        detail: 'Google returned no ID token naming the account',
      });
    }
    return this.keep(scope, scope.organizationId, {
      accountEmail: grant.account.email,
      accountSubject: grant.account.subject,
      refreshTokenSealed: this.sealer.seal(grant.refreshToken),
      scopes: grant.scopes,
    });
  }

  private async keep(
    scope: ConnectGoogleCalendarCommand['scope'],
    organizationId: string,
    grant: CalendarGrantProps,
  ): Promise<AggregateID> {
    const held = await this.connections.findAllOwn(scope);
    const same =
      held.find((row) => row.accountSubject !== null && row.isAccountOf(grant)) ??
      held.find((row) => row.isAccountOf(grant));
    if (same) {
      same.reconnect(grant);
      await this.connections.save(same);
      return same.id;
    }
    const colorIndex = nextColorIndex(held.map((row) => row.colorIndex));
    if (!canConnectAnotherAccount(held.length) || colorIndex === null) {
      throw new AppError(CalendarErrors.GOOGLE_ACCOUNT_LIMIT_REACHED);
    }
    const connection = CalendarConnectionEntity.connect({
      organizationId,
      userId: scope.userId,
      colorIndex,
      ...grant,
    });
    await this.connections.insert(connection);
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
