import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { SentryConnectionRepositoryPort } from '../../database/sentry-connection.repository.port';
import { SENTRY_CONNECTION_REPOSITORY } from '../../sentry.di-tokens';
import { RemoveSentryConnectionCommand } from './remove-sentry-connection.command';

/**
 * Forgets the workspace's Sentry organization. Its webhook URL answers 404
 * from then on, and the triggers that named it never fire again; they stay
 * on their automations for the owner to remove. No connection does nothing.
 */
@CommandHandler(RemoveSentryConnectionCommand)
export class RemoveSentryConnectionCommandHandler
  implements ICommandHandler<RemoveSentryConnectionCommand, void>
{
  constructor(
    @Inject(SENTRY_CONNECTION_REPOSITORY)
    private readonly connections: SentryConnectionRepositoryPort,
  ) {}

  async execute({ scope }: RemoveSentryConnectionCommand): Promise<void> {
    if (!scope.organizationId) return;
    await this.connections.deleteForOrganization(scope.organizationId);
  }
}
