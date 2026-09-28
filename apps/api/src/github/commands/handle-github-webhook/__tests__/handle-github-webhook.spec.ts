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
 * The webhook writes through a conditional update rather than the aggregate.
 *
 * A delivery that loaded the row, mutated it and saved it back would write the
 * whole row again — `deletedAt` included — so a suspend or unsuspend that
 * arrived while a disconnect was committing would resurrect a claim the
 * workspace had given up. These tests pin the shape of the write; the
 * integration spec pins that the SQL actually refuses a disconnected row.
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

  it('logs an out-of-order delivery apart from one no workspace holds', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const subject = build('stale');

    await expect(subject.handler.execute(delivery('suspend'))).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Ignoring an out-of-order installation webhook' }),
    );
    log.mockRestore();
  });

  it('records an uninstall without touching the suspension', async () => {
    const subject = build();

    await subject.handler.execute(delivery('deleted'));

    const [change] = subject.installations.applyStatusChange.mock.calls[0];
    expect(change.deletedAt).toBeInstanceOf(Date);
    expect(change).not.toHaveProperty('suspendedAt');
  });

  it('refuses a delivery whose signature does not match the bytes received', async () => {
    const subject = build();
    const forged = new HandleGithubWebhookCommand({
      payload: JSON.stringify({ action: 'deleted', installation: { id: 45678901 } }),
      signature: sign('something else entirely'),
      event: 'installation',
      deliveryId: 'd-2',
    });

    await expect(subject.handler.execute(forged)).rejects.toMatchObject({ code: 'GITHUB_007' });
    expect(subject.installations.applyStatusChange).not.toHaveBeenCalled();
  });

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

  it('hands nothing to the hub when the signature is forged', async () => {
    const subject = build();
    const forged = new HandleGithubWebhookCommand({
      payload: JSON.stringify({ action: 'opened' }),
      signature: sign('other'),
      event: 'pull_request',
      deliveryId: 'd-3',
    });

    await expect(subject.handler.execute(forged)).rejects.toMatchObject({ code: 'GITHUB_007' });
    expect(subject.commandBus.execute).not.toHaveBeenCalled();
  });

  it('is quiet when no live installation matches', async () => {
    // A delivery for an installation no workspace holds is a fact about somebody
    // else's account. It is logged and dropped, never retried.
    const subject = build('missing');

    await expect(subject.handler.execute(delivery('suspend'))).resolves.toBeUndefined();
  });
});
