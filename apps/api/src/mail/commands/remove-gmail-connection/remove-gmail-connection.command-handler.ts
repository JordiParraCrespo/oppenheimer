import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { GmailConnectionRepositoryPort } from '../../database/gmail-connection.repository.port';
import type { GmailProviderPort } from '../../infrastructure/gmail-provider.port';
import type { TokenSealerPort } from '../../infrastructure/token-sealer.port';
import {
  GMAIL_CONNECTION_REPOSITORY,
  GMAIL_PROVIDER,
  MAIL_TOKEN_SEALER,
} from '../../mail.di-tokens';
import { RemoveGmailConnectionCommand } from './remove-gmail-connection.command';

/**
 * Disconnects one of the caller's Gmail accounts: revokes its grant at
 * Google, best effort, and forgets it. An id that is not one of the caller's
 * does nothing; a token sealed under a key since replaced is forgotten
 * without the revoke it can no longer make.
 */
@CommandHandler(RemoveGmailConnectionCommand)
export class RemoveGmailConnectionCommandHandler
  implements ICommandHandler<RemoveGmailConnectionCommand, void>
{
  constructor(
    @Inject(GMAIL_PROVIDER)
    private readonly provider: GmailProviderPort,
    @Inject(MAIL_TOKEN_SEALER)
    private readonly sealer: TokenSealerPort,
    @Inject(GMAIL_CONNECTION_REPOSITORY)
    private readonly connections: GmailConnectionRepositoryPort,
  ) {}

  async execute({ scope, connectionId }: RemoveGmailConnectionCommand): Promise<void> {
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
