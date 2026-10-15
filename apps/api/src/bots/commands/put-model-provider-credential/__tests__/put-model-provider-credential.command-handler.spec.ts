import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { ModelProviderResolver } from '../../../application/model-provider.resolver';
import type { ModelProviderCredentialRepositoryPort } from '../../../database/model-provider-credential.repository.port';
import type { ProviderKeySealerPort } from '../../../infrastructure/provider-key-sealer.port';
import { PutModelProviderCredentialCommand } from '../put-model-provider-credential.command';
import { PutModelProviderCredentialCommandHandler } from '../put-model-provider-credential.command-handler';

/**
 * Storing a provider key: it is sealed before the repository sees it, with
 * only its last four characters beside it; an unknown provider, ChatGPT (which
 * signs in instead), a server with no sealing key and a caller with no
 * workspace are refused with nothing written.
 */
const scope = (organizationId: string | null = randomUUID()): AccessScope => ({
  userId: randomUUID(),
  organizationId,
  teamIds: [],
  grants: new Map(),
  bypass: false,
});

function setup(configured = true) {
  const sealer: ProviderKeySealerPort = {
    isConfigured: () => configured,
    seal: (plaintext) => Buffer.from(`sealed(${plaintext.length})`),
    open: () => '',
  };
  const credentials: Pick<ModelProviderCredentialRepositoryPort, 'put'> = { put: vi.fn() };
  const handler = new PutModelProviderCredentialCommandHandler(
    new ModelProviderResolver(sealer),
    sealer,
    credentials as ModelProviderCredentialRepositoryPort,
  );
  return { handler, credentials };
}

const command = (provider: string, s = scope()) =>
  new PutModelProviderCredentialCommand({ scope: s, provider, apiKey: 'zai-key-abcd' });

describe('PutModelProviderCredentialCommandHandler', () => {
  it('stores the key sealed, with its last four characters', async () => {
    const { handler, credentials } = setup();
    await handler.execute(command('glm'));
    const [stored] = vi.mocked(credentials.put).mock.calls[0];
    expect(stored).toMatchObject({ provider: 'glm', keyHint: 'abcd' });
    expect(stored.sealedKey.toString()).toBe('sealed(12)');
  });

  it('refuses a provider the catalog does not list with BOTS_012, and writes nothing', async () => {
    const { handler, credentials } = setup();
    await expect(handler.execute(command('mistral'))).rejects.toMatchObject({ code: 'BOTS_012' });
    expect(credentials.put).not.toHaveBeenCalled();
  });

  it('refuses a key for ChatGPT, which connects by signing in, with BOTS_015, and writes nothing', async () => {
    const { handler, credentials } = setup();
    await expect(handler.execute(command('chatgpt'))).rejects.toMatchObject({ code: 'BOTS_015' });
    expect(credentials.put).not.toHaveBeenCalled();
  });

  it('refuses on a server with no sealing key with BOTS_011, and writes nothing', async () => {
    const { handler, credentials } = setup(false);
    await expect(handler.execute(command('glm'))).rejects.toMatchObject({ code: 'BOTS_011' });
    expect(credentials.put).not.toHaveBeenCalled();
  });

  it('refuses a caller with no workspace with BOTS_002', async () => {
    const { handler } = setup();
    await expect(handler.execute(command('glm', scope(null)))).rejects.toMatchObject({
      code: 'BOTS_002',
    });
  });
});
