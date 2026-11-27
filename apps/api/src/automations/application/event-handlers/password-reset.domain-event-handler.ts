import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PasswordResetDomainEvent } from '../../../auth/domain/events/password-reset.domain-event';
import type { WorkspaceLookupPort } from '../../../organizations/application/workspace-lookup.port';
import { WORKSPACE_LOOKUP } from '../../../organizations/organizations.di-tokens';
import { AUTOMATION_WEBHOOK_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationWebhookRepositoryPort } from '../../database/automation-webhook.repository.port';

/** The fields of the event this handler reads, as the outbox delivers them. */
type PasswordReset = Pick<PasswordResetDomainEvent, 'userId' | 'resetAt'>;

/**
 * A password reset revokes the routine webhook URLs of the account's
 * workspace that were issued from an address nobody had proven
 * (`issuedVerified` false): a deployment that delivered no email then let
 * anyone who registered the address first issue one, and a URL starts runs
 * with no sign-in. URLs issued from a verified address stay. The routine keeps
 * its webhook trigger; the owner issues a new URL.
 *
 * Only URLs issued up to the reset: the event is delivered at least once, and
 * a redelivery must not take one the owner issued afterwards. Nothing is
 * caught: a failure throws, and the outbox delivers the event again.
 */
@Injectable()
export class PasswordResetRevokesWebhooksDomainEventHandler {
  private readonly logger = new Logger(PasswordResetRevokesWebhooksDomainEventHandler.name);

  constructor(
    @Inject(WORKSPACE_LOOKUP)
    private readonly workspaces: WorkspaceLookupPort,
    @Inject(AUTOMATION_WEBHOOK_REPOSITORY)
    private readonly webhooks: AutomationWebhookRepositoryPort,
  ) {}

  @OnEvent(PasswordResetDomainEvent.name)
  async handle(event: PasswordReset): Promise<void> {
    const revoked = await this.webhooks.revokeIssuedUnverified(
      await this.workspaces.ownedBy(event.userId),
      new Date(event.resetAt),
    );
    if (revoked > 0) {
      this.logger.log({
        message: 'Revoked the webhook URLs an unverified address issued, after a password reset',
        userId: event.userId,
        revoked,
      });
    }
  }
}
