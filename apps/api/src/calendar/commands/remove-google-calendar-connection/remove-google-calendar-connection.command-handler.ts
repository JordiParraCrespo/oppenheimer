import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  CALENDAR_CONNECTION_REPOSITORY,
  CALENDAR_PROVIDER,
  TOKEN_SEALER,
} from '../../calendar.di-tokens';
import type { CalendarConnectionRepositoryPort } from '../../database/calendar-connection.repository.port';
import type { CalendarProviderPort } from '../../infrastructure/calendar-provider.port';
import type { TokenSealerPort } from '../../infrastructure/token-sealer.port';
import { RemoveGoogleCalendarConnectionCommand } from './remove-google-calendar-connection.command';

/**
 * Removes one of the caller's Google accounts: revokes its grant at Google,
 * best effort, and forgets it, which frees its colour for the next account.
 * An id that is not one of the caller's does nothing; a token sealed under a
 * key since replaced is forgotten without the revoke it can no longer make.
 */
@CommandHandler(RemoveGoogleCalendarConnectionCommand)
export class RemoveGoogleCalendarConnectionCommandHandler
  implements ICommandHandler<RemoveGoogleCalendarConnectionCommand, void>
{
  constructor(
    @Inject(CALENDAR_PROVIDER)
    private readonly provider: CalendarProviderPort,
    @Inject(TOKEN_SEALER)
    private readonly sealer: TokenSealerPort,
    @Inject(CALENDAR_CONNECTION_REPOSITORY)
    private readonly connections: CalendarConnectionRepositoryPort,
  ) {}

  async execute({ scope, connectionId }: RemoveGoogleCalendarConnectionCommand): Promise<void> {
    const found = await this.connections.findOwnById(scope, connectionId);
    if (found.isNone()) return;
    const connection = found.unwrap();
    if (this.sealer.isConfigured()) {
      try {
        await this.provider.revoke({
          connectionId: connection.id,
          refreshToken: this.sealer.open(connection.refreshTokenSealed),
        });
      } catch {
        // Unsealable or unreachable: the row goes either way.
      }
    }
    await this.connections.delete(connection);
  }
}
