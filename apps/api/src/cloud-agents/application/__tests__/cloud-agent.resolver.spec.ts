import type { AccessScope } from '@oppenheimer/backend-authz';
import { describe, expect, it, vi } from 'vitest';
import { CloudAgentResolver } from '../cloud-agent.resolver';
import type { CloudAgentProvider } from '../cloud-agent-provider.port';
import { CloudAgentProviderRegistry } from '../cloud-agent-provider.registry';

/**
 * Who a cloud agent call goes to: the provider it names, and nothing else.
 * There is no fallback (a cloud agent lives at the vendor it was launched
 * on), so a provider the caller has no key for is `CLOUD_AGENTS_004` and its
 * grant is never asked for; an unknown name is `CLOUD_AGENTS_011`.
 */

const scope = (organizationId: string | null = 'org-1') =>
  ({ organizationId, userId: 'user-1' }) as unknown as AccessScope;

function provider(available: boolean): CloudAgentProvider<string> {
  return {
    id: 'cursor',
    availableFor: vi.fn().mockResolvedValue(available),
    identify: vi.fn(),
    grantFor: vi.fn().mockResolvedValue('grant'),
    launch: vi.fn(),
    read: vi.fn(),
    models: vi.fn(),
    repositories: vi.fn(),
  };
}

describe('CloudAgentResolver', () => {
  it('answers the named provider and the caller’s grant for it', async () => {
    const cursor = provider(true);
    const resolver = new CloudAgentResolver(new CloudAgentProviderRegistry([cursor]));

    await expect(resolver.callFor(scope(), 'cursor')).resolves.toEqual({
      provider: cursor,
      grant: 'grant',
    });
    expect(cursor.availableFor).toHaveBeenCalledWith('org-1', 'user-1');
  });

  it('refuses a provider the caller has no key for with CLOUD_AGENTS_004, asking no grant', async () => {
    const cursor = provider(false);
    const resolver = new CloudAgentResolver(new CloudAgentProviderRegistry([cursor]));

    await expect(resolver.callFor(scope(), 'cursor')).rejects.toMatchObject({
      code: 'CLOUD_AGENTS_004',
    });
    expect(cursor.grantFor).not.toHaveBeenCalled();
  });

  it('refuses a name no provider has with CLOUD_AGENTS_011, and a caller with no workspace with 002', async () => {
    const resolver = new CloudAgentResolver(new CloudAgentProviderRegistry([provider(true)]));

    expect(() => resolver.providerFor('devin')).toThrow(
      expect.objectContaining({ code: 'CLOUD_AGENTS_011' }),
    );
    await expect(resolver.callFor(scope(null), 'cursor')).rejects.toMatchObject({
      code: 'CLOUD_AGENTS_002',
    });
  });

  it('refuses two providers with one id', () => {
    expect(() => new CloudAgentProviderRegistry([provider(true), provider(true)])).toThrow(
      /share an id/,
    );
  });
});
