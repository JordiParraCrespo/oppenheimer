import { Inject } from '@nestjs/common';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError, type KeySealer } from '@oppenheimer/backend-core';
import { ReceiveInboundDeliveryCommand } from '../../../inbound-events/commands/receive-inbound-delivery/receive-inbound-delivery.command';
import type { SentryConnectionRepositoryPort } from '../../database/sentry-connection.repository.port';
import { SentryErrors } from '../../domain/sentry.errors';
import {
  type SentryDeliveryPayload,
  sentryEventName,
} from '../../infrastructure/sentry-event-normalizer.util';
import {
  parseSentryBody,
  sentryPayloadDigest,
  verifySentrySignature,
} from '../../infrastructure/sentry-webhook.util';
import { SENTRY_CONNECTION_REPOSITORY, SENTRY_SECRET_SEALER } from '../../sentry.di-tokens';
import { HandleSentryWebhookCommand } from './handle-sentry-webhook.command';

/**
 * One connection's webhook: the URL names the connection, so its secret
 * checks the signature before a byte is stored; a verified delivery goes to
 * the inbound-events hub with the workspace written into it, keyed by
 * Sentry's request id (or, without one, the digest of the signed bytes).
 * The hub drops what no trigger listens to (`SentryEventSource.accepts`).
 *
 * Both of the hub's dedupe keys carry the connection: the same signed body
 * reaching two workspaces' connections is one delivery for each, and a retry
 * to one connection is still the same delivery.
 */
@CommandHandler(HandleSentryWebhookCommand)
export class HandleSentryWebhookCommandHandler
  implements ICommandHandler<HandleSentryWebhookCommand, void>
{
  constructor(
    @Inject(SENTRY_CONNECTION_REPOSITORY)
    private readonly connections: SentryConnectionRepositoryPort,
    @Inject(SENTRY_SECRET_SEALER) private readonly sealer: KeySealer,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: HandleSentryWebhookCommand): Promise<void> {
    const found = await this.connections.findById(command.connectionId);
    if (found.isNone() || !this.sealer.isConfigured()) {
      throw new AppError(SentryErrors.NOT_CONNECTED);
    }
    const connection = found.unwrap();
    const secret = this.sealer.open(connection.sealedClientSecret);
    if (!verifySentrySignature(secret, command.payload, command.signature)) {
      throw new AppError(SentryErrors.WEBHOOK_SIGNATURE_INVALID);
    }
    const body = parseSentryBody(command.payload);
    if (!body || !command.resource) return;

    const digest = sentryPayloadDigest(connection.id, command.payload);
    const payload: SentryDeliveryPayload = {
      connectionId: connection.id,
      organizationId: connection.organizationId,
      organizationSlug: connection.organizationSlug,
      resource: command.resource,
      body,
    };
    await this.commandBus.execute(
      new ReceiveInboundDeliveryCommand({
        source: 'sentry',
        deliveryId: `${connection.id}:${command.requestId || digest}`,
        eventName: sentryEventName(command.resource, body),
        payload: { ...payload },
        payloadDigest: digest,
        metadata: { correlationId: command.metadata.correlationId },
      }),
    );
  }
}
