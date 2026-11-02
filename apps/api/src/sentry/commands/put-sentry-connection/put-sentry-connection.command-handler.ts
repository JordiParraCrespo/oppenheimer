import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError, type KeySealer } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { SentryConnectionRepositoryPort } from '../../database/sentry-connection.repository.port';
import { SentryErrors } from '../../domain/sentry.errors';
import { SentryConnectionEntity, secretHintOf } from '../../domain/sentry-connection.entity';
import { SENTRY_CONNECTION_REPOSITORY, SENTRY_SECRET_SEALER } from '../../sentry.di-tokens';
import { PutSentryConnectionCommand } from './put-sentry-connection.command';

/**
 * Connects the workspace's Sentry organization, or replaces its slug and
 * secret: the connection keeps its id, so the webhook URL already pasted into
 * Sentry stays right. The secret is sealed and never returned.
 */
@CommandHandler(PutSentryConnectionCommand)
export class PutSentryConnectionCommandHandler
  implements ICommandHandler<PutSentryConnectionCommand, AggregateID>
{
  constructor(
    @Inject(SENTRY_SECRET_SEALER) private readonly sealer: KeySealer,
    @Inject(SENTRY_CONNECTION_REPOSITORY)
    private readonly connections: SentryConnectionRepositoryPort,
  ) {}

  async execute(command: PutSentryConnectionCommand): Promise<AggregateID> {
    const organizationId = command.scope.organizationId;
    if (!organizationId) throw new AppError(SentryErrors.NOT_CONNECTED);
    if (!this.sealer.isConfigured()) throw new AppError(SentryErrors.NOT_CONFIGURED);
    const stored = await this.connections.put(
      SentryConnectionEntity.connect({
        organizationId,
        organizationSlug: command.organizationSlug,
        sealedClientSecret: this.sealer.seal(command.clientSecret),
        secretHint: secretHintOf(command.clientSecret),
        createdByUserId: command.scope.userId,
      }),
    );
    return stored.id;
  }
}
