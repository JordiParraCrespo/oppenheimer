import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireTenant } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { GmailConnectStateResolver } from '../../application/gmail-connect-state.resolver';
import type { GmailConnectionRepositoryPort } from '../../database/gmail-connection.repository.port';
import {
  canConnectAnotherGmailAccount,
  defaultGmailLabel,
} from '../../domain/gmail-accounts.policy';
import { GmailConnectionEntity, type GmailGrantProps } from '../../domain/gmail-connection.entity';
import { MailErrors } from '../../domain/mail.errors';
import {
  GMAIL_SCOPE,
  type GmailGrant,
  type GmailProviderPort,
} from '../../infrastructure/gmail-provider.port';
import type { TokenSealerPort } from '../../infrastructure/token-sealer.port';
import {
  GMAIL_CONNECTION_REPOSITORY,
  GMAIL_PROVIDER,
  MAIL_TOKEN_SEALER,
} from '../../mail.di-tokens';
import { ConnectGmailCommand } from './connect-gmail.command';

/**
 * Finishes connecting a Gmail account: the state is spent first, so a stolen
 * redirect cannot be replayed, then the code is exchanged once. A grant
 * without a refresh token, without the Gmail permission or without an ID
 * token (which says which account it is) is refused rather than stored.
 *
 * An account the person already connected is reconnected in place, keeping
 * its label; any other is a new connection, up to five, named after its
 * address until the person renames it.
 */
@CommandHandler(ConnectGmailCommand)
export class ConnectGmailCommandHandler
  implements ICommandHandler<ConnectGmailCommand, AggregateID>
{
  constructor(
    @Inject(GMAIL_PROVIDER)
    private readonly provider: GmailProviderPort,
    @Inject(MAIL_TOKEN_SEALER)
    private readonly sealer: TokenSealerPort,
    @Inject(GMAIL_CONNECTION_REPOSITORY)
    private readonly connections: GmailConnectionRepositoryPort,
    private readonly states: GmailConnectStateResolver,
  ) {}

  async execute({ scope, input }: ConnectGmailCommand): Promise<AggregateID> {
    requireTenant(scope);
    if (!this.provider.isConfigured() || !this.sealer.isConfigured()) {
      throw new AppError(MailErrors.GMAIL_NOT_CONFIGURED);
    }
    await this.states.redeem(input.state, scope.userId, scope.organizationId);

    const grant = await this.exchange(input.code);
    if (!grant.refreshToken || !grant.scopes.includes(GMAIL_SCOPE)) {
      throw new AppError(MailErrors.GMAIL_GRANT_REFUSED, {
        detail: grant.refreshToken
          ? 'The Gmail permission was not granted'
          : 'Google returned no refresh token',
      });
    }
    if (!grant.account) {
      throw new AppError(MailErrors.GMAIL_GRANT_REFUSED, {
        detail: 'Google returned no ID token naming the account',
      });
    }
    return this.keep(scope, scope.organizationId, {
      googleSubject: grant.account.subject,
      accountEmail: grant.account.email,
      refreshTokenSealed: this.sealer.seal(grant.refreshToken),
      scopes: grant.scopes,
    });
  }

  private async keep(
    scope: ConnectGmailCommand['scope'],
    organizationId: string,
    grant: GmailGrantProps,
  ): Promise<AggregateID> {
    const held = await this.connections.findAllOwn(scope);
    const same = held.find((row) => row.googleSubject === grant.googleSubject);
    if (same) {
      same.reconnect(grant);
      await this.connections.save(same);
      return same.id;
    }
    if (!canConnectAnotherGmailAccount(held.length)) {
      throw new AppError(MailErrors.GMAIL_ACCOUNT_LIMIT_REACHED);
    }
    const connection = GmailConnectionEntity.connect({
      organizationId,
      userId: scope.userId,
      label: defaultGmailLabel(grant.accountEmail),
      ...grant,
    });
    await this.connections.insert(connection);
    return connection.id;
  }

  private async exchange(code: string): Promise<GmailGrant> {
    try {
      return await this.provider.exchange(code);
    } catch (error) {
      // Google's quota (`MAIL_008`) is not a refused code.
      if (error instanceof AppError) throw error;
      throw new AppError(MailErrors.GMAIL_GRANT_REFUSED, {
        detail: 'Google refused the authorization code',
      });
    }
  }
}
