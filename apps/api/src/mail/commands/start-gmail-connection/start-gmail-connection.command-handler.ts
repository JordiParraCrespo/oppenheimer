import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireTenant } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { GmailConnectStateResolver } from '../../application/gmail-connect-state.resolver';
import type { GmailConnectionRepositoryPort } from '../../database/gmail-connection.repository.port';
import { canConnectAnotherGmailAccount } from '../../domain/gmail-accounts.policy';
import { MailErrors } from '../../domain/mail.errors';
import type { GmailProviderPort } from '../../infrastructure/gmail-provider.port';
import type { TokenSealerPort } from '../../infrastructure/token-sealer.port';
import {
  GMAIL_CONNECTION_REPOSITORY,
  GMAIL_PROVIDER,
  MAIL_TOKEN_SEALER,
} from '../../mail.di-tokens';
import { StartGmailConnectionCommand } from './start-gmail-connection.command';

export interface StartedGmailConnection {
  url: string;
  expiresAt: Date;
}

/**
 * Starts connecting a Gmail account: a single-use state for this person in
 * this workspace, and Google's consent page carrying it, with the account
 * chooser. Reconnecting one of the caller's accounts opens the chooser on its
 * address; a new account past the fifth is refused here, before Google is
 * asked. More than an id comes back because the state is about this request;
 * no query can read it.
 */
@CommandHandler(StartGmailConnectionCommand)
export class StartGmailConnectionCommandHandler
  implements ICommandHandler<StartGmailConnectionCommand, StartedGmailConnection>
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

  async execute({ scope, input }: StartGmailConnectionCommand): Promise<StartedGmailConnection> {
    requireTenant(scope);
    if (!this.provider.isConfigured() || !this.sealer.isConfigured()) {
      throw new AppError(MailErrors.GMAIL_NOT_CONFIGURED);
    }
    const loginHint = await this.loginHint(scope, input.connectionId);
    const { state, expiresAt } = await this.states.mint(scope.userId, scope.organizationId);
    return { url: this.provider.authorizationUrl(state, loginHint), expiresAt };
  }

  /** The address to open Google's chooser on for a reconnect; none for a new account. */
  private async loginHint(
    scope: StartGmailConnectionCommand['scope'],
    connectionId: string | undefined,
  ): Promise<string | undefined> {
    if (connectionId) {
      const found = await this.connections.findOwnById(scope, connectionId);
      if (found.isNone()) throw new AppError(MailErrors.GMAIL_NOT_CONNECTED);
      return found.unwrap().accountEmail;
    }
    const held = await this.connections.findAllOwn(scope);
    if (!canConnectAnotherGmailAccount(held.length)) {
      throw new AppError(MailErrors.GMAIL_ACCOUNT_LIMIT_REACHED);
    }
    return undefined;
  }
}
