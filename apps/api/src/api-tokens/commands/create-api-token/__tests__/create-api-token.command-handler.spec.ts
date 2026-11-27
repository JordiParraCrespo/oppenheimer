import { CapabilitiesService } from '@oppenheimer/backend-core';
import { defineAbilitiesFromPermissions } from '@oppenheimer/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CredentialIssuanceResolver } from '../../../../auth/application/credential-issuance.resolver';
import type { CredentialOwnerPort } from '../../../../auth/application/credential-owner.port';
import type { CredentialOwner } from '../../../../auth/domain/scope-context.types';
import type { AbilityFactory } from '../../../../roles/application/ability.factory';
import type { ApiTokenRepositoryPort } from '../../../database/api-token.repository.port';
import type { OrganizationMembershipReaderPort } from '../../../database/organization-membership.repository.port';
import type { ApiTokenEntity } from '../../../domain/api-token.entity';
import { CreateApiTokenCommand } from '../create-api-token.command';
import { CreateApiTokenCommandHandler } from '../create-api-token.command-handler';

const ADMIN_PERMISSIONS = [{ action: 'manage', subject: 'all' }];
const READER_PERMISSIONS = [{ action: 'read', subject: 'User' }];

describe('CreateApiTokenCommandHandler', () => {
  let service: CreateApiTokenCommandHandler;
  let repo: Pick<ApiTokenRepositoryPort, 'insertWithinLimit'>;
  let memberships: OrganizationMembershipReaderPort;
  let abilityFactory: Pick<AbilityFactory, 'createForUser'>;
  let owners: CredentialOwnerPort;

  const owner = (overrides: Partial<CredentialOwner> = {}): CredentialOwner => ({
    id: 'user-1',
    email: 'owner@example.com',
    firstName: 'Owner',
    lastName: 'Example',
    role: 'user',
    isActive: true,
    emailVerified: true,
    ...overrides,
  });

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
      insertWithinLimit: vi.fn().mockResolvedValue('inserted'),
    };
    memberships = {
      findOrganizationIdsForUser: vi.fn().mockResolvedValue(['org-1']),
    };
    abilityFactory = { createForUser: vi.fn() };
    useAbility(ADMIN_PERMISSIONS);
    owners = {
      findActiveOwner: vi.fn(),
      requireActiveOwner: vi.fn().mockResolvedValue(owner()),
    };

    service = new CreateApiTokenCommandHandler(
      repo as ApiTokenRepositoryPort,
      memberships,
      abilityFactory as AbilityFactory,
      new CredentialIssuanceResolver(owners, new CapabilitiesService({ email_delivery: true })),
    );
  });

  const insertedToken = () => vi.mocked(repo.insertWithinLimit).mock.calls[0][0] as ApiTokenEntity;

  it('mints a token and returns the secret exactly once', async () => {
    const result = await service.execute(command());

    expect(repo.insertWithinLimit).toHaveBeenCalledTimes(1);
    expect(result.secret).toMatch(/^oppenheimer_pat_/);
    expect(result.tokenId).toBe(insertedToken().id);
  });

  // Pre-account squatting: someone registers the victim's address first and
  // mints a token that would outlive the real owner's password reset.
  it('refuses an account whose email is not verified, and writes nothing', async () => {
    vi.mocked(owners.requireActiveOwner).mockResolvedValue(owner({ emailVerified: false }));

    await expect(service.execute(command())).rejects.toMatchObject({ code: 'TOKEN_010' });
    expect(owners.requireActiveOwner).toHaveBeenCalledWith('user-1');
    expect(repo.insertWithinLimit).not.toHaveBeenCalled();
  });

  // A password reset refuses every credential whose chain began before it.
  // Regression: a request on a pre-reset token that raced the reset minted a
  // token stamped "now", which outlived the reset.
  it('stamps the new token with the issue time of the credential that minted it', async () => {
    const minterIssuedAt = new Date('2026-01-01T00:00:00.000Z');
    await service.execute(
      command({ actor: { id: 'user-1', role: 'user', issuedUnder: minterIssuedAt } }),
    );

    expect(insertedToken().issuedAt).toEqual(minterIssuedAt);
  });

  it('starts a token’s chain at its mint when the minter’s is unknown or in the future', async () => {
    const before = Date.now();
    await service.execute(
      command({ actor: { id: 'user-1', role: 'user', issuedUnder: new Date(before + 60_000) } }),
    );

    expect(insertedToken().issuedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(insertedToken().issuedAt.getTime()).toBeLessThanOrEqual(Date.now());
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
      { organizationId: null },
    );
  });

  it('refuses scopes the creator does not hold, naming them', async () => {
    useAbility(READER_PERMISSIONS);

    // The catalog message titles the problem type; the scopes this particular
    // request over-reached on are the problem's detail (RFC 7807).
    await expect(
      service.execute(command({ scopes: ['users:read', 'roles:write'] })),
    ).rejects.toMatchObject({
      code: 'TOKEN_002',
      detail: expect.stringContaining('roles:write'),
      extensions: { ungrantableScopes: ['roles:write'] },
    });
    expect(repo.insertWithinLimit).not.toHaveBeenCalled();
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
    expect(repo.insertWithinLimit).not.toHaveBeenCalled();
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
    vi.mocked(repo.insertWithinLimit).mockResolvedValue('limit_reached');

    await expect(service.execute(command())).rejects.toMatchObject({
      code: 'TOKEN_009',
    });
    // The limit is checked where the token is written, in one step.
    expect(vi.mocked(repo.insertWithinLimit).mock.calls[0][1]).toBe(50);
  });

  it('passes through the requested lifetime and IP allowlist', async () => {
    await service.execute(command({ expiresInDays: 7, ipAllowlist: ['203.0.113.0/24'] }));

    const stored = insertedToken();
    expect(stored.expiresAt).toBeInstanceOf(Date);
    expect(stored.ipAllowlist).toEqual(['203.0.113.0/24']);
  });

  describe('minted with a token rather than a browser session', () => {
    const narrow = { scopes: ['tokens:write' as const], organizationIds: ['org-1'] };

    it('refuses scopes the presenting token lacks, though its owner holds them, and writes nothing', async () => {
      await expect(
        service.execute(
          command({
            actor: { id: 'user-1', role: 'user', credential: narrow },
            scopes: ['hosts:write', 'tokens:write'],
            organizationIds: ['org-1'],
          }),
        ),
      ).rejects.toMatchObject({
        code: 'TOKEN_002',
        extensions: { ungrantableScopes: ['hosts:write'] },
      });
      expect(repo.insertWithinLimit).not.toHaveBeenCalled();
    });

    it('refuses to drop or widen the organizations the presenting token is pinned to', async () => {
      for (const organizationIds of [undefined, ['org-1', 'org-2']]) {
        await expect(
          service.execute(
            command({
              actor: { id: 'user-1', role: 'user', credential: narrow },
              scopes: ['tokens:write'],
              organizationIds,
            }),
          ),
        ).rejects.toMatchObject({ code: 'TOKEN_002' });
      }
      expect(repo.insertWithinLimit).not.toHaveBeenCalled();
    });

    it('mints within the presenting token’s reach, a write scope covering its read', async () => {
      await service.execute(
        command({
          actor: {
            id: 'user-1',
            role: 'user',
            credential: { scopes: ['tokens:write', 'hosts:write'], organizationIds: ['org-1'] },
          },
          scopes: ['hosts:read'],
          organizationIds: ['org-1'],
        }),
      );
      expect(repo.insertWithinLimit).toHaveBeenCalledTimes(1);
    });
  });
});
