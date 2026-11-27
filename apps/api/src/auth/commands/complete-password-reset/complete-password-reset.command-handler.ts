import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DELEGATED_SESSION, OAUTH_GRANT_REPOSITORY } from '../../auth.di-tokens';
import type { OAuthGrantRepositoryPort } from '../../database/oauth-grant.repository.port';
import { PasswordResetDomainEvent } from '../../domain/events/password-reset.domain-event';
import type { DelegatedSessionPort } from '../../infrastructure/delegated-session.port';
import { CompletePasswordResetCommand } from './complete-password-reset.command';

/**
 * A reset is what someone does when they believe another person has their
 * account, and that person may hold credentials that outlive the sessions
 * Better Auth deletes (`revokeSessionsOnPasswordReset`): an API token, an
 * OAuth or MCP grant. So all of them go.
 *
 * What makes that hold is the account's credential cutoff, written in this
 * handler's one transaction: from its commit, every scoped credential whose
 * chain began before the reset is refused on its next request
 * (`CredentialScopeResolver`), and no code or refresh token signed in before
 * it is exchanged (`oauth-grant-gate.util.ts`). Nothing waits on the outbox.
 * The same transaction deletes the kernel's own OAuth grants, consents and
 * pending authorization codes, and stages `PasswordResetDomainEvent`, on which
 * api-tokens marks its tokens revoked so they read as revoked in the console.
 * The cached delegated sessions those credentials act through are dropped
 * last. Idempotent: a second run moves no cutoff back and finds nothing left.
 */
@CommandHandler(CompletePasswordResetCommand)
export class CompletePasswordResetCommandHandler
  implements ICommandHandler<CompletePasswordResetCommand, void>
{
  private readonly logger = new Logger(CompletePasswordResetCommandHandler.name);

  constructor(
    @Inject(OAUTH_GRANT_REPOSITORY)
    private readonly oauthGrants: OAuthGrantRepositoryPort,
    @Inject(DELEGATED_SESSION)
    private readonly delegatedSessions: DelegatedSessionPort,
  ) {}

  async execute(command: CompletePasswordResetCommand): Promise<void> {
    const revoked = await this.oauthGrants.revokeAllForUser(command.userId, command.resetAt, [
      new PasswordResetDomainEvent({
        aggregateId: command.userId,
        userId: command.userId,
        resetAt: command.resetAt.toISOString(),
        reason: 'Password was reset; every credential the account issued before it must be revoked',
      }),
    ]);
    await this.delegatedSessions.invalidateForUser(command.userId);
    this.logger.log({
      message: 'Revoked credentials after a password reset',
      userId: command.userId,
      oauthTokens: revoked,
    });
  }
}
