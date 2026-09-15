import { defineAbilitiesFromPermissions } from '@oppenheimer/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AbilityFactory } from '../../../../roles/services/ability.factory';
import type { ApiTokenRepositoryPort } from '../../../database/api-token.repository.port';
import type { OrganizationMembershipReaderPort } from '../../../database/organization-membership.repository.port';
import type { ApiTokenEntity } from '../../../domain/api-token.entity';
import { CreateApiTokenCommand } from '../create-api-token.command';
import { CreateApiTokenService } from '../create-api-token.service';

const ADMIN_PERMISSIONS = [{ action: 'manage', subject: 'all' }];
const READER_PERMISSIONS = [{ action: 'read', subject: 'User' }];

describe('CreateApiTokenService', () => {
  let service: CreateApiTokenService;
  let repo: Pick<ApiTokenRepositoryPort, 'insert' | 'countActiveForUser'>;
  let memberships: OrganizationMembershipReaderPort;
  let abilityFactory: Pick<AbilityFactory, 'createForUser'>;

  const useAbility = (permissions: { action: string; subject: string }[]) => {
    vi.mocked(abilityFactory.createForUser).mockResolvedValue(
      defineAbilitiesFromPermissions(permissions),
    );
  };

  const command = (
    overrides: Partial<ConstructorParameters<typeof CreateApiTokenCommand>[0]> = {},
  ) =>
    new CreateApiTokenCommand({
      actor: { id: 'user-1', role: 'user' },
      name: 'CI deploy',
      scopes: ['users:read'],
      ...overrides,
    });

  beforeEach(() => {
    repo = {
      insert: vi.fn().mockResolvedValue(undefined),
      countActiveForUser: vi.fn().mockResolvedValue(0),
    };
    memberships = {
      findOrganizationIdsForUser: vi.fn().mockResolvedValue(['org-1']),
    };
    abilityFactory = { createForUser: vi.fn() };
    useAbility(ADMIN_PERMISSIONS);

    service = new CreateApiTokenService(
      repo as ApiTokenRepositoryPort,
      memberships,
      abilityFactory as AbilityFactory,
    );
  });

  const insertedToken = () => vi.mocked(repo.insert).mock.calls[0][0] as ApiTokenEntity;

  it('mints a token and returns the secret exactly once', async () => {
    const result = await service.execute(command());

    expect(repo.insert).toHaveBeenCalledTimes(1);
    expect(result.secret).toMatch(/^oppenheimer_pat_/);
    expect(result.tokenId).toBe(insertedToken().id);
  });

  it('never persists the secret, only its digest', async () => {
    const result = await service.execute(command());
    const stored = insertedToken();

    expect(stored.tokenHash).not.toBe(result.secret);
    expect(JSON.stringify(stored)).not.toContain(result.secret);
  });

  it('rebuilds the ability from the actor’s roles rather than trusting the request', async () => {
    await service.execute(command({ actor: { id: 'user-1', role: 'user' } }));

    expect(abilityFactory.createForUser).toHaveBeenCalledWith(
      { id: 'user-1', role: 'user' },
      { activeOrganizationId: null },
    );
  });

  it('refuses scopes the creator does not hold', async () => {
    useAbility(READER_PERMISSIONS);

    await expect(service.execute(command({ scopes: ['roles:write'] }))).rejects.toMatchObject({
      code: 'TOKEN_002',
    });
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('names the offending scopes so the caller can fix the request', async () => {
    useAbility(READER_PERMISSIONS);

    // The catalog message titles the problem type; the scopes this particular
    // request over-reached on are the problem's detail (RFC 7807).
    await expect(
      service.execute(command({ scopes: ['users:read', 'roles:write'] })),
    ).rejects.toMatchObject({
      detail: expect.stringContaining('roles:write'),
      extensions: { ungrantableScopes: ['roles:write'] },
    });
  });

  it('allows scopes the creator does hold', async () => {
    useAbility(READER_PERMISSIONS);

    await expect(service.execute(command({ scopes: ['users:read'] }))).resolves.toBeDefined();
  });

  it('always allows the profile group, which governs the caller’s own account', async () => {
    useAbility([]);

    await expect(service.execute(command({ scopes: ['profile:read'] }))).resolves.toBeDefined();
  });

  it('refuses to scope a token to an organization the creator is not a member of', async () => {
    await expect(service.execute(command({ organizationIds: ['org-2'] }))).rejects.toMatchObject({
      code: 'TOKEN_008',
    });
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('accepts an organization the creator belongs to', async () => {
    await service.execute(command({ organizationIds: ['org-1'] }));
    expect(insertedToken().organizationIds).toEqual(['org-1']);
  });

  it('skips the membership lookup when no organization is requested', async () => {
    await service.execute(command());
    expect(memberships.findOrganizationIdsForUser).not.toHaveBeenCalled();
  });

  it('refuses once the active token limit is reached', async () => {
    vi.mocked(repo.countActiveForUser).mockResolvedValue(50);

    await expect(service.execute(command())).rejects.toMatchObject({
      code: 'TOKEN_009',
    });
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('passes through the requested lifetime and IP allowlist', async () => {
    await service.execute(command({ expiresInDays: 7, ipAllowlist: ['203.0.113.0/24'] }));

    const stored = insertedToken();
    expect(stored.expiresAt).toBeInstanceOf(Date);
    expect(stored.ipAllowlist).toEqual(['203.0.113.0/24']);
  });
});
