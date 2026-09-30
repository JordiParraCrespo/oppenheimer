import type { ExecutionContext } from '@nestjs/common';
import { toResourceScope } from '@oppenheimer/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CredentialScopePort } from '../../../auth/application/credential-scope.port';
import type { ScopedRequest } from '../../../auth/domain/scope-context.types';
import { HOST_PRINCIPAL, type HostPrincipalRequest } from '../../decorators/current-host.decorator';
import { HostPrincipalGuard } from '../host-principal.guard';

/**
 * The whole authorization of the `/hosts/self` routes. There is no person on such a
 * request, so if this guard admitted anyone else the route would be open.
 */
describe('HostPrincipalGuard', () => {
  let request: ScopedRequest & HostPrincipalRequest;
  let credentials: Pick<CredentialScopePort, 'resolve'>;
  let guard: HostPrincipalGuard;

  const context = () =>
    ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext;

  const host = () => ({
    kind: 'host' as const,
    credentialId: 'host:host-1',
    hostId: 'host-1',
    scopes: [],
    resourceScope: toResourceScope(null),
    expiresAt: null,
  });

  beforeEach(() => {
    request = { headers: {} };
    credentials = { resolve: vi.fn().mockResolvedValue(null) };
    guard = new HostPrincipalGuard(credentials as CredentialScopePort);
  });

  it('admits a host and leaves it where the route can read it', async () => {
    vi.mocked(credentials.resolve).mockResolvedValue(host());

    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(request[HOST_PRINCIPAL]).toEqual({ hostId: 'host-1' });
  });

  it('refuses a browser session', async () => {
    request.user = { id: 'jordi' };

    await expect(guard.canActivate(context())).rejects.toMatchObject({ code: 'HOSTS_005' });
    expect(request[HOST_PRINCIPAL]).toBeUndefined();
  });

  it('refuses a perfectly valid API token', async () => {
    vi.mocked(credentials.resolve).mockResolvedValue({
      kind: 'api-token',
      credentialId: 'token-1',
      userId: 'jordi',
      owner: {
        id: 'jordi',
        email: 'jordi@example.com',
        firstName: 'Jordi',
        lastName: 'P',
        role: 'user',
        isActive: true,
        emailVerified: true,
      },
      scopes: ['hosts:write'],
      resourceScope: toResourceScope(null),
      expiresAt: null,
    });

    await expect(guard.canActivate(context())).rejects.toMatchObject({ code: 'HOSTS_005' });
  });

  it('lets the resolver’s own rejection through', async () => {
    vi.mocked(credentials.resolve).mockRejectedValue(new Error('invalid credential'));

    await expect(guard.canActivate(context())).rejects.toThrow('invalid credential');
  });
});
