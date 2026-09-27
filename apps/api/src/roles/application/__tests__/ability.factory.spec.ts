import { canAccessRow } from '@oppenheimer/backend-authz';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoleRepositoryPort } from '../../database/role.repository.port';
import type { UserRoleRepositoryPort } from '../../database/user-role.repository.port';
import { RoleEntity } from '../../domain/role.entity';
import { Permission } from '../../domain/value-objects/permission.value-object';
import { AbilityFactory } from '../ability.factory';

function makeRole(name: string, permissions: Permission[], isSystem = false): RoleEntity {
  return RoleEntity.create({
    id: `role-${name}`,
    props: {
      name,
      description: null,
      isSystem,
      organizationId: null,
      permissions,
    },
  });
}

describe('AbilityFactory', () => {
  let factory: AbilityFactory;
  let userRoleRepo: UserRoleRepositoryPort;
  let roleRepo: Pick<RoleRepositoryPort, 'findOneByName'>;

  beforeEach(() => {
    userRoleRepo = {
      findRoleIdsForUser: vi.fn(),
      findRolesForUser: vi.fn().mockResolvedValue([]),
      setRolesForUser: vi.fn(),
      assignRoleToUser: vi.fn(),
      replaceMembershipRole: vi.fn(),
    };
    roleRepo = { findOneByName: vi.fn().mockResolvedValue(None) };
    factory = new AbilityFactory(userRoleRepo, roleRepo as RoleRepositoryPort);
  });

  it('builds the ability from the union of the user’s assigned roles', async () => {
    vi.mocked(userRoleRepo.findRolesForUser).mockResolvedValue([
      makeRole('reader', [Permission.fromDefinition({ action: 'read', subject: 'User' })]),
      makeRole('writer', [Permission.fromDefinition({ action: 'create', subject: 'Article' })]),
    ]);

    const ability = await factory.createForUser({ id: 'user-1' });

    expect(ability.can('read', 'User')).toBe(true);
    expect(ability.can('create', 'Article')).toBe(true);
    expect(ability.can('delete', 'User')).toBe(false);
  });

  describe('forRequest', () => {
    /** A request `ApiAuthGuard` stamped with its tenant. */
    const requestIn = (organizationId: string | null, source: 'route' | 'session' = 'route') => ({
      user: { id: 'user-1' },
      session: { activeTeamId: null },
      tenant: { organizationId, source },
    });

    it("builds the ability in the request's tenant", async () => {
      await factory.forRequest(requestIn('org-b'));

      expect(userRoleRepo.findRolesForUser).toHaveBeenCalledWith('user-1', 'org-b');
    });

    it('resolves the organization placeholder to the tenant', async () => {
      vi.mocked(userRoleRepo.findRolesForUser).mockResolvedValue([
        makeRole('owner', [
          Permission.fromDefinition({
            action: 'read',
            subject: 'Member',
            // biome-ignore lint/suspicious/noTemplateCurlyInString: a stored condition placeholder
            conditions: { organizationId: '${activeOrganizationId}' },
          }),
        ]),
      ]);

      const ability = await factory.forRequest(requestIn('org-b'));

      expect(canAccessRow(ability, 'read', 'Member', { organizationId: 'org-b' })).toBe(true);
      expect(canAccessRow(ability, 'read', 'Member', { organizationId: 'org-a' })).toBe(false);
    });

    it('acts in no organization on a request no guard stamped: only global roles count', async () => {
      await factory.forRequest({ user: { id: 'user-1' } });

      expect(userRoleRepo.findRolesForUser).toHaveBeenCalledWith('user-1', null);
    });

    it('builds the ability once per request and serves every later caller the same one', async () => {
      const request = requestIn('org-b');

      const first = await factory.forRequest(request);
      const second = await factory.forRequest(request);

      expect(second).toBe(first);
      expect(request).toMatchObject({ ability: first });
      expect(userRoleRepo.findRolesForUser).toHaveBeenCalledTimes(1);
    });

    it("never serves one organization's memoized ability for another", async () => {
      // The contract has no organization argument to disagree with the memo:
      // the organization is the request's, and a memo built for one tenant is
      // not reused once the request names another.
      expect(factory.forRequest.length).toBe(1);
      const request: { user: { id: string }; tenant: { organizationId: string; source: 'route' } } =
        { user: { id: 'user-1' }, tenant: { organizationId: 'org-a', source: 'route' } };

      const inA = await factory.forRequest(request);
      request.tenant = { organizationId: 'org-b', source: 'route' };
      const inB = await factory.forRequest(request);

      expect(inB).not.toBe(inA);
      expect(userRoleRepo.findRolesForUser).toHaveBeenNthCalledWith(1, 'user-1', 'org-a');
      expect(userRoleRepo.findRolesForUser).toHaveBeenNthCalledWith(2, 'user-1', 'org-b');
    });
  });

  it('falls back to the legacy role name via the DB role when no assignments exist', async () => {
    vi.mocked(userRoleRepo.findRolesForUser).mockResolvedValue([]);
    vi.mocked(roleRepo.findOneByName).mockResolvedValue(
      Some(
        makeRole('admin', [Permission.fromDefinition({ action: 'manage', subject: 'all' })], true),
      ),
    );

    const ability = await factory.createForUser({
      id: 'user-1',
      role: 'admin',
    });

    expect(ability.can('delete', 'Role')).toBe(true);
    expect(roleRepo.findOneByName).toHaveBeenCalledWith('admin');
  });

  it('unions the Better Auth `user.role` column with the assigned join roles', async () => {
    // Simulates an admin-plugin `set-role` promotion: the user keeps their
    // default `user` join row but `user.role` is now `admin`, so CASL must also
    // grant the `admin` role's permissions.
    vi.mocked(userRoleRepo.findRolesForUser).mockResolvedValue([
      makeRole('user', [Permission.fromDefinition({ action: 'read', subject: 'User' })]),
    ]);
    vi.mocked(roleRepo.findOneByName).mockResolvedValue(
      Some(
        makeRole('admin', [Permission.fromDefinition({ action: 'manage', subject: 'all' })], true),
      ),
    );

    const ability = await factory.createForUser({
      id: 'user-1',
      role: 'admin',
    });

    expect(ability.can('read', 'User')).toBe(true); // from the join role
    expect(ability.can('delete', 'Role')).toBe(true); // from user.role = admin
  });

  it('unions comma-separated Better Auth platform roles', async () => {
    vi.mocked(roleRepo.findOneByName).mockImplementation(async (name) =>
      name === 'admin'
        ? Some(
            makeRole(
              'admin',
              [Permission.fromDefinition({ action: 'manage', subject: 'all' })],
              true,
            ),
          )
        : None,
    );

    const ability = await factory.createForUser({ id: 'user-1', role: 'user, admin' });

    expect(ability.can('delete', 'Role')).toBe(true);
    expect(roleRepo.findOneByName).toHaveBeenNthCalledWith(1, 'user');
    expect(roleRepo.findOneByName).toHaveBeenNthCalledWith(2, 'admin');
  });

  it('falls back to the seeded system-role permissions when the role is not in the DB', async () => {
    vi.mocked(userRoleRepo.findRolesForUser).mockResolvedValue([]);
    vi.mocked(roleRepo.findOneByName).mockResolvedValue(None);

    const ability = await factory.createForUser({ id: 'user-1', role: 'user' });

    // The seeded `user` set grants its own API tokens and nothing else, so
    // that rule is what proves the fallback was taken rather than an empty
    // ability being returned. (`Article` used to serve as this marker, until
    // it turned out to be boilerplate with nothing behind it.)
    expect(ability.can('read', 'ApiToken')).toBe(true);
    expect(ability.can('read', 'User')).toBe(false);
    expect(ability.can('delete', 'User')).toBe(false);
    expect(ability.can('manage', 'all')).toBe(false);
  });
});
