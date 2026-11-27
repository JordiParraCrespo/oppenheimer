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
 * The OAuth grants are the kernel's own and are deleted here; the API tokens
 * belong to a module the kernel does not know, which revokes its own on the
 * `PasswordResetDomainEvent` staged in the same transaction. The cached
 * delegated sessions those credentials act through are dropped last.
 * Idempotent: a second run finds nothing left to revoke.
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
    const revoked = await this.oauthGrants.revokeAllForUser(command.userId, [
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
