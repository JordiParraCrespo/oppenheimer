import { IsNull } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { RoleEntity } from '../../domain/role.entity';
import { Permission } from '../../domain/value-objects/permission.value-object';
import { RoleMapper } from '../../roles.mapper';
import { RoleOrmEntity } from '../role.orm-entity';
import { RoleRepository } from '../role.repository';

function roleIn(organizationId: string | null): RoleEntity {
  return RoleEntity.create({
    id: 'role-1',
    props: {
      name: 'reviewer',
      description: null,
      isSystem: false,
      organizationId,
      permissions: [Permission.fromDefinition({ action: 'read', subject: 'Session' })],
    },
  });
}

/**
 * The adapter over a stubbed outbox whose transaction manager records every
 * statement, in order, so a bump can be shown to run inside the write's
 * transaction and before or after the write itself.
 */
function repositoryWith() {
  const log: string[] = [];
  const roles = {
    insert: vi.fn(async () => {
      log.push('insert');
      return {};
    }),
    save: vi.fn(async (record: RoleOrmEntity) => {
      log.push('save');
      return { ...record, createdAt: new Date(), updatedAt: new Date() };
    }),
    delete: vi.fn(async () => {
      log.push('delete');
      return { affected: 1 };
    }),
  };
  const manager = {
    getRepository: vi.fn(() => roles),
    query: vi.fn(async (sql: string) => {
      log.push(sql.includes('user_role_version') ? 'bump:users' : sql);
    }),
  };
  const outbox = {
    writeWithEvents: vi.fn(async (_entities: unknown, work: (m: typeof manager) => unknown) =>
      work(manager),
    ),
  };
  const find = vi.fn().mockResolvedValue([]);
  const repository = new RoleRepository({ find } as never, new RoleMapper(), outbox as never);
  return { repository, manager, outbox, log, find };
}

const ORG_BUMP = 'UPDATE "organization" SET "roleVersion" = "roleVersion" + 1 WHERE "id" = $1';
const CATALOG_BUMP = 'UPDATE "role_catalog_version" SET "version" = "version" + 1 WHERE "id" = 1';

describe('RoleRepository: version bumps', () => {
  describe.each([
    ['insert', (r: RoleRepository, e: RoleEntity) => r.insert(e), ['insert']],
    ['save', (r: RoleRepository, e: RoleEntity) => r.save(e), ['save']],
  ] as const)('%s', (_name, write, [statement]) => {
    it('of a global role bumps the role catalog, in the write’s transaction', async () => {
      const { repository, log, outbox } = repositoryWith();

      await write(repository, roleIn(null));

      expect(outbox.writeWithEvents).toHaveBeenCalledTimes(1);
      expect(log).toEqual([statement, CATALOG_BUMP]);
    });

    it('of an organization’s role bumps that organization and its holders elsewhere', async () => {
      const { repository, log, manager } = repositoryWith();

      await write(repository, roleIn('org-1'));

      expect(log).toEqual([statement, ORG_BUMP, 'bump:users']);
      expect(manager.query).toHaveBeenCalledWith(ORG_BUMP, ['org-1']);
      expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('"user_role_version"'), [
        'role-1',
        'org-1',
      ]);
    });
  });

  describe('delete', () => {
    it('of a global role bumps the catalog before the cascade', async () => {
      const { repository, log } = repositoryWith();

      await repository.delete(roleIn(null));

      expect(log).toEqual([CATALOG_BUMP, 'delete']);
    });

    it('of an organization’s role bumps its holders while their assignments still exist', async () => {
      const { repository, log } = repositoryWith();

      await repository.delete(roleIn('org-1'));

      expect(log).toEqual([ORG_BUMP, 'bump:users', 'delete']);
    });
  });
});

describe('RoleRepository.findGlobal', () => {
  it('reads the global rows only', async () => {
    const { repository, find } = repositoryWith();

    await repository.findGlobal();

    expect(find).toHaveBeenCalledWith({ where: { organizationId: IsNull() } });
  });
});
