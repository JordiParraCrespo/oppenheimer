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
import { DisconnectGoogleCalendarCommand } from './disconnect-google-calendar.command';

/**
 * Revokes the grant at Google, best effort, and forgets it. Disconnecting with no
 * connection does nothing; a token sealed under a key since replaced is forgotten
 * without the revoke it can no longer make.
 */
@CommandHandler(DisconnectGoogleCalendarCommand)
export class DisconnectGoogleCalendarCommandHandler
  implements ICommandHandler<DisconnectGoogleCalendarCommand, void>
{
  constructor(
    @Inject(CALENDAR_PROVIDER)
    private readonly provider: CalendarProviderPort,
    @Inject(TOKEN_SEALER)
    private readonly sealer: TokenSealerPort,
    @Inject(CALENDAR_CONNECTION_REPOSITORY)
    private readonly connections: CalendarConnectionRepositoryPort,
  ) {}

  async execute({ scope }: DisconnectGoogleCalendarCommand): Promise<void> {
    const found = await this.connections.findOwn(scope);
    if (found.isNone()) return;
    const connection = found.unwrap();
    if (this.sealer.isConfigured()) {
      try {
        await this.provider.revoke(this.sealer.open(connection.refreshTokenSealed));
      } catch {
        // Unsealable or unreachable: the row goes either way.
      }
    }
    await this.connections.delete(connection);
  }
}
