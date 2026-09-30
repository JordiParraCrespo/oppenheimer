import { createHash, createHmac } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { CommandBus } from '@nestjs/cqrs';
import { describe, expect, it, vi } from 'vitest';
import type {
  GithubInstallationRepositoryPort,
  InstallationStatusChangeResult,
} from '../../../database/github-installation.repository.port';
import { HandleGithubWebhookCommand } from '../handle-github-webhook.command';
import { HandleGithubWebhookCommandHandler } from '../handle-github-webhook.command-handler';

/**
 * The webhook writes through a conditional update rather than the aggregate
 * (why: `GithubInstallationRepositoryPort.applyStatusChange`). These tests pin
 * the shape of the write; the integration spec pins that the SQL actually
 * refuses a disconnected row.
 */

const SECRET = 'a-webhook-signing-secret';

function sign(payload: string): string {
  return `sha256=${createHmac('sha256', SECRET).update(payload).digest('hex')}`;
}

function build(result: InstallationStatusChangeResult = 'applied') {
  const installations = {
    applyStatusChange: vi.fn().mockResolvedValue(result),
  } satisfies Pick<GithubInstallationRepositoryPort, 'applyStatusChange'>;

  const configService = {
    get: (key: string) => (key === 'githubApp.webhookSecret' ? SECRET : undefined),
  } as ConfigService;

  const commandBus = { execute: vi.fn().mockResolvedValue('stored') };

  const handler = new HandleGithubWebhookCommandHandler(
    installations as unknown as GithubInstallationRepositoryPort,
    configService,
    commandBus as unknown as CommandBus,
  );

  return { handler, installations, commandBus };
}

function delivery(action: string, event = 'installation') {
  const payload = JSON.stringify({ action, installation: { id: 45678901 } });
  return new HandleGithubWebhookCommand({
    payload,
    signature: sign(payload),
    event,
    deliveryId: 'd-1',
  });
}

describe('installation webhook', () => {
  it('writes only the column the action is about', async () => {
    const subject = build();

    await subject.handler.execute(delivery('suspend'));

    const [change] = subject.installations.applyStatusChange.mock.calls[0];
    expect(change.githubInstallationId).toBe(45678901);
    expect(change.suspendedAt).toBeInstanceOf(Date);
    // `deletedAt` is not named, so the statement cannot touch it — which is what
    // keeps a delivery from reviving a disconnected installation.
    expect(change).not.toHaveProperty('deletedAt');
  });

  it('clears the suspension on unsuspend, and nothing else', async () => {
    const subject = build();

    await subject.handler.execute(delivery('unsuspend'));

    expect(subject.installations.applyStatusChange).toHaveBeenCalledWith({
      githubInstallationId: 45678901,
      occurredAt: expect.any(Date),
      suspendedAt: null,
    });
  });

  it("orders the write by GitHub's time, and suspends at that time rather than ours", async () => {
    const subject = build();
    const payload = JSON.stringify({
      action: 'suspend',
      installation: { id: 45678901, suspended_at: '2026-09-01T09:00:00Z' },
    });

    await subject.handler.execute(
      new HandleGithubWebhookCommand({
        payload,
        signature: sign(payload),
        event: 'installation',
        deliveryId: 'd-4',
      }),
    );

    expect(subject.installations.applyStatusChange).toHaveBeenCalledWith({
      githubInstallationId: 45678901,
      occurredAt: new Date('2026-09-01T09:00:00Z'),
      suspendedAt: new Date('2026-09-01T09:00:00Z'),
    });
  });

  it('applies a payload with no time at receipt time, and says so', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    const subject = build();
    const before = Date.now();

    await subject.handler.execute(delivery('suspend'));

    const [change] = subject.installations.applyStatusChange.mock.calls[0];
    expect(change.occurredAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(change.suspendedAt).toEqual(change.occurredAt);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('no time') }),
    );
    warn.mockRestore();
  });

  it.each([
    // An older delivery than the one already applied: expected, and quiet.
    ['stale', 'log', 'Ignoring an out-of-order installation webhook'],
    // A fact about somebody else's account: logged and dropped, never retried.
    ['missing', 'warn', 'Ignoring an installation webhook for an installation no workspace holds'],
  ] as const)('drops a %s delivery, logged as itself', async (result, level, message) => {
    const logged = vi.spyOn(Logger.prototype, level).mockImplementation(() => {});
    const subject = build(result);

    await expect(subject.handler.execute(delivery('suspend'))).resolves.toBeUndefined();

    expect(logged).toHaveBeenCalledWith(expect.objectContaining({ message }));
    logged.mockRestore();
  });

  it('records an uninstall without touching the suspension', async () => {
    const subject = build();

    await subject.handler.execute(delivery('deleted'));

    const [change] = subject.installations.applyStatusChange.mock.calls[0];
    expect(change.deletedAt).toBeInstanceOf(Date);
    expect(change).not.toHaveProperty('suspendedAt');
  });

  it.each([
    ['an installation', 'installation', { action: 'deleted', installation: { id: 45678901 } }],
    ['any other', 'pull_request', { action: 'opened' }],
  ])(
    'refuses %s delivery whose signature does not match the bytes received',
    async (_kind, event, body) => {
      const subject = build();
      const forged = new HandleGithubWebhookCommand({
        payload: JSON.stringify(body),
        signature: sign('something else entirely'),
        event,
        deliveryId: 'd-2',
      });

      await expect(subject.handler.execute(forged)).rejects.toMatchObject({ code: 'GITHUB_007' });
      expect(subject.installations.applyStatusChange).not.toHaveBeenCalled();
      expect(subject.commandBus.execute).not.toHaveBeenCalled();
    },
  );

  it('writes nothing for an installation action this module does not act on', async () => {
    const subject = build();

    await subject.handler.execute(delivery('new_permissions_accepted'));

    expect(subject.installations.applyStatusChange).not.toHaveBeenCalled();
    expect(subject.commandBus.execute).not.toHaveBeenCalled();
  });

  it('hands every other verified event to the inbound-events hub, keyed by its delivery id', async () => {
    const subject = build();

    await subject.handler.execute(delivery('opened', 'pull_request'));

    expect(subject.installations.applyStatusChange).not.toHaveBeenCalled();
    const [command] = subject.commandBus.execute.mock.calls[0];
    expect(command).toMatchObject({
      source: 'github',
      deliveryId: 'd-1',
      eventName: 'pull_request',
      payload: { action: 'opened' },
    });
  });

  it('digests the raw bytes it was sent, not the JSON they parse to', async () => {
    // Whitespace JSON.parse would drop: a digest of the parsed object would
    // miss that these are exactly the bytes GitHub signed.
    const subject = build();
    const payload = '{ "action" :  "opened",\n  "number": 7 }\n';
    const raw = Buffer.from(payload, 'utf8');

    await subject.handler.execute(
      new HandleGithubWebhookCommand({
        payload: raw,
        signature: sign(payload),
        event: 'pull_request',
        deliveryId: 'd-5',
      }),
    );

    const [command] = subject.commandBus.execute.mock.calls[0];
    expect(command.payloadDigest).toBe(createHash('sha256').update(raw).digest('hex'));
    expect(command.payloadDigest).not.toBe(
      createHash('sha256')
        .update(JSON.stringify(JSON.parse(payload)))
        .digest('hex'),
    );
  });
});
