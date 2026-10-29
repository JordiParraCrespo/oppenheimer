import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { GmailConnectionRepositoryPort } from '../database/gmail-connection.repository.port';
import type { GmailConnectionEntity } from '../domain/gmail-connection.entity';
import { MailErrors } from '../domain/mail.errors';
import {
  type GmailCallGrant,
  GmailGrantRevokedError,
  GmailNotFoundError,
  type GmailProviderPort,
} from '../infrastructure/gmail-provider.port';
import type { TokenSealerPort } from '../infrastructure/token-sealer.port';
import { GMAIL_CONNECTION_REPOSITORY, GMAIL_PROVIDER, MAIL_TOKEN_SEALER } from '../mail.di-tokens';

/**
 * Every call a query makes to Gmail goes through here: the caller's own
 * connection, its grant opened for this one call, and Gmail's answers read
 * onto mail's codes. A grant Google dropped marks the connection revoked, so
 * Settings offers Reconnect and the bot is told to ask for it.
 */
@Injectable()
export class GmailCallResolver {
  constructor(
    @Inject(GMAIL_PROVIDER)
    private readonly provider: GmailProviderPort,
    @Inject(MAIL_TOKEN_SEALER)
    private readonly sealer: TokenSealerPort,
    @Inject(GMAIL_CONNECTION_REPOSITORY)
    private readonly connections: GmailConnectionRepositoryPort,
  ) {}

  /** The caller's active connection with this id, or `MAIL_001`. */
  async activeConnection(scope: AccessScope, connectionId: string): Promise<GmailConnectionEntity> {
    this.assertConfigured();
    const found = await this.connections.findOwnById(scope, connectionId);
    if (found.isNone() || !found.unwrap().isActive) {
      throw new AppError(MailErrors.GMAIL_NOT_CONNECTED, {
        detail: found.isNone()
          ? 'No Gmail account of yours has that id'
          : `${found.unwrap().accountEmail} needs to be reconnected in Settings → Mail`,
      });
    }
    return found.unwrap();
  }

  /** Runs one provider call with the connection's grant, its failures read onto mail's codes. */
  async call<T>(
    connection: GmailConnectionEntity,
    run: (provider: GmailProviderPort, grant: GmailCallGrant) => Promise<T>,
  ): Promise<T> {
    const grant = this.grantOf(connection);
    try {
      return await run(this.provider, grant);
    } catch (error) {
      // Gmail's quota (`MAIL_008`) passes through as is.
      if (error instanceof AppError) throw error;
      if (error instanceof GmailGrantRevokedError) {
        await this.connections.markRevoked(connection);
        throw new AppError(MailErrors.GMAIL_NOT_CONNECTED, {
          detail: `Google dropped the grant for ${connection.accountEmail}; reconnect it in Settings → Mail`,
        });
      }
      if (error instanceof GmailNotFoundError) {
        throw new AppError(MailErrors.GMAIL_ITEM_NOT_FOUND);
      }
      throw new AppError(MailErrors.GMAIL_UNAVAILABLE);
    }
  }

  private grantOf(connection: GmailConnectionEntity): GmailCallGrant {
    try {
      return {
        connectionId: connection.id,
        refreshToken: this.sealer.open(connection.refreshTokenSealed),
      };
    } catch {
      // Sealed under a key since replaced: it can never be opened again.
      throw new AppError(MailErrors.GMAIL_NOT_CONNECTED, {
        detail: `${connection.accountEmail} needs to be reconnected in Settings → Mail`,
      });
    }
  }

  private assertConfigured(): void {
    if (!this.provider.isConfigured() || !this.sealer.isConfigured()) {
      throw new AppError(MailErrors.GMAIL_NOT_CONFIGURED);
    }
  }
}
