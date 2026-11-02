import { createHmac } from 'node:crypto';
import { AppError, type KeySealer } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { ReceiveInboundDeliveryCommand } from '../../inbound-events/commands/receive-inbound-delivery/receive-inbound-delivery.command';
import { HandleSentryWebhookCommand } from '../commands/handle-sentry-webhook/handle-sentry-webhook.command';
import { HandleSentryWebhookCommandHandler } from '../commands/handle-sentry-webhook/handle-sentry-webhook.command-handler';
import type { SentryConnectionRepositoryPort } from '../database/sentry-connection.repository.port';
import { SentryConnectionEntity } from '../domain/sentry-connection.entity';

/**
 * The webhook's door. What breaks this: an unsigned or wrongly signed body
 * reaching the hub (anyone who learns a connection's URL could start runs), a
 * delivery stored under the wrong workspace, or a retried delivery stored twice.
 */
const SECRET = 'a-client-secret-of-sentry';
const sealer: KeySealer = {
  isConfigured: () => true,
  seal: (plain) => Buffer.from(plain),
  open: (sealed) => sealed.toString(),
};
const connection = SentryConnectionEntity.create({
  id: '6f1c2d3e-0000-4000-8000-000000000001',
  props: {
    organizationId: 'org-1',
    organizationSlug: 'acme',
    sealedClientSecret: Buffer.from(SECRET),
    secretHint: 'ntry',
    createdByUserId: 'user-1',
  },
});

function setup(found = true) {
  const executed: unknown[] = [];
  const connections = {
    findById: vi.fn(async () => (found ? Some(connection) : None)),
  } as unknown as SentryConnectionRepositoryPort;
  const commandBus = { execute: vi.fn(async (command: unknown) => executed.push(command)) };
  const handler = new HandleSentryWebhookCommandHandler(
    connections,
    sealer,
    commandBus as never,
  );
  return { handler, executed };
}

const body = Buffer.from(JSON.stringify({ action: 'created', data: { issue: { id: '1' } } }));
const sign = (bytes: Buffer, secret = SECRET) =>
  createHmac('sha256', secret).update(bytes).digest('hex');

const webhook = (signature: string, requestId = 'req-1') =>
  new HandleSentryWebhookCommand({
    connectionId: connection.id,
    payload: body,
    signature,
    resource: 'issue',
    requestId,
  });

describe('HandleSentryWebhookCommandHandler', () => {
  it('hands a correctly signed delivery to the hub, under its connection’s workspace', async () => {
    const { handler, executed } = setup();
    await handler.execute(webhook(sign(body)));

    expect(executed).toHaveLength(1);
    const delivery = executed[0] as ReceiveInboundDeliveryCommand;
    expect(delivery).toBeInstanceOf(ReceiveInboundDeliveryCommand);
    expect(delivery).toMatchObject({
      source: 'sentry',
      deliveryId: 'req-1',
      eventName: 'issue.created',
      payload: {
        connectionId: connection.id,
        organizationId: 'org-1',
        organizationSlug: 'acme',
        resource: 'issue',
        body: { action: 'created', data: { issue: { id: '1' } } },
      },
    });
  });

  it('refuses a body signed with another secret, or not signed', async () => {
    const { handler, executed } = setup();
    for (const signature of [sign(body, 'another-secret-entirely'), '']) {
      await expect(handler.execute(webhook(signature))).rejects.toMatchObject({
        code: 'SENTRY_003',
      });
    }
    expect(executed).toEqual([]);
  });

  it('answers a URL no connection holds as not connected', async () => {
    const { handler } = setup(false);
    const refused = handler.execute(webhook(sign(body)));
    await expect(refused).rejects.toBeInstanceOf(AppError);
    await expect(refused).rejects.toMatchObject({ code: 'SENTRY_002' });
  });

  it('keys a delivery Sentry sent with no request id by the digest of its bytes', async () => {
    const { handler, executed } = setup();
    await handler.execute(webhook(sign(body), ''));
    const delivery = executed[0] as ReceiveInboundDeliveryCommand;
    expect(delivery.deliveryId).toBe(delivery.payloadDigest);
  });
});
