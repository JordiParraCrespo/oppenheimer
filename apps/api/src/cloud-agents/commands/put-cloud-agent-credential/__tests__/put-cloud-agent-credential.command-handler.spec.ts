import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { describe, expect, it, vi } from 'vitest';
import type { CloudAgentResolver } from '../../../application/cloud-agent.resolver';
import type { CloudAgentProvider } from '../../../application/cloud-agent-provider.port';
import type { CloudAgentCredentialRepositoryPort } from '../../../database/cloud-agent-credential.repository.port';
import { CloudAgentErrors } from '../../../domain/cloud-agents.errors';
import type { KeySealerPort } from '../../../infrastructure/key-sealer.port';
import { PutCloudAgentCredentialCommand } from '../put-cloud-agent-credential.command';
import { PutCloudAgentCredentialCommandHandler } from '../put-cloud-agent-credential.command-handler';

/**
 * Connecting a vendor asks it whose the key is before anything is stored: a
 * key it refuses is never kept, and one it accepts is kept sealed, with the
 * vendor's answer beside it and only its last four characters in the clear.
 */

const scope = { organizationId: 'org-1', userId: 'user-1' } as unknown as AccessScope;

function setup(identify: CloudAgentProvider['identify'], configured = true) {
  const provider = { id: 'cursor', identify } as unknown as CloudAgentProvider;
  const resolver = { providerFor: vi.fn(() => provider) } as unknown as CloudAgentResolver;
  const sealer: KeySealerPort = {
    isConfigured: () => configured,
    seal: (plain) => Buffer.from(`sealed:${plain.length}`),
    open: vi.fn(),
  };
  const credentials: Pick<CloudAgentCredentialRepositoryPort, 'put'> = { put: vi.fn() };
  const handler = new PutCloudAgentCredentialCommandHandler(
    resolver,
    sealer,
    credentials as CloudAgentCredentialRepositoryPort,
  );
  return { handler, credentials };
}

const command = () =>
  new PutCloudAgentCredentialCommand({ scope, provider: 'cursor', apiKey: 'crsr_secret_9f3a' });

describe('PutCloudAgentCredentialCommandHandler', () => {
  it('keeps an accepted key sealed, with whose it is and its last four characters', async () => {
    const { handler, credentials } = setup(
      vi.fn().mockResolvedValue({ keyName: 'Laptop', email: 'ana@example.com', accountId: '184' }),
    );

    await handler.execute(command());

    const stored = vi.mocked(credentials.put).mock.calls[0][0];
    expect(stored.sealedKey.toString()).not.toContain('crsr_secret');
    expect(stored).toMatchObject({ keyHint: '9f3a', keyName: 'Laptop', accountId: '184' });
    expect(stored.userId).toBe('user-1');
  });

  it('stores nothing when the vendor refuses the key', async () => {
    const { handler, credentials } = setup(
      vi.fn().mockRejectedValue(new AppError(CloudAgentErrors.KEY_REFUSED)),
    );
    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'CLOUD_AGENTS_005' });
    expect(credentials.put).not.toHaveBeenCalled();
  });

  it('refuses on a server that cannot seal, before the vendor sees the key', async () => {
    const identify = vi.fn();
    const { handler, credentials } = setup(identify, false);
    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'CLOUD_AGENTS_003' });
    expect(identify).not.toHaveBeenCalled();
    expect(credentials.put).not.toHaveBeenCalled();
  });
});
