import { createHmac } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { GithubInstallationRepositoryPort } from '../../../database/github-installation.repository.port';
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

function build(applied = true) {
  const installations = {
    applyStatusChange: vi.fn().mockResolvedValue(applied),
  } satisfies Pick<GithubInstallationRepositoryPort, 'applyStatusChange'>;

  const configService = {
    get: (key: string) => (key === 'githubApp.webhookSecret' ? SECRET : undefined),
  } as ConfigService;

  const handler = new HandleGithubWebhookCommandHandler(
    installations as unknown as GithubInstallationRepositoryPort,
    configService,
  );

  return { handler, installations };
}

function delivery(action: string, event = 'installation') {
  const payload = JSON.stringify({ action, installation: { id: 45678901 } });
  return new HandleGithubWebhookCommand({ payload, signature: sign(payload), event });
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
      suspendedAt: null,
    });
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
    });

    await expect(subject.handler.execute(forged)).rejects.toMatchObject({ code: 'GITHUB_007' });
    expect(subject.installations.applyStatusChange).not.toHaveBeenCalled();
  });

  it('writes nothing for an event this module does not act on', async () => {
    const subject = build();

    await subject.handler.execute(delivery('added', 'installation_repositories'));
    await subject.handler.execute(delivery('new_permissions_accepted'));

    expect(subject.installations.applyStatusChange).not.toHaveBeenCalled();
  });

  it('is quiet when no live installation matches', async () => {
    // A delivery for an installation no workspace holds is a fact about somebody
    // else's account. It is logged and dropped, never retried.
    const subject = build(false);

    await expect(subject.handler.execute(delivery('suspend'))).resolves.toBeUndefined();
  });
});
