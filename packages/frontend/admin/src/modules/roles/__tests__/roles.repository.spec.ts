import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RolesErrors } from '../roles.errors';

const rolesApi = vi.hoisted(() => ({
  findAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  findUserRoles: vi.fn(),
  assign: vi.fn(),
}));
const authorizationApi = vi.hoisted(() => ({ catalog: vi.fn() }));

vi.mock('@oppenheimer/api-client', () => ({
  AuthorizationApi: authorizationApi,
  RolesApi: rolesApi,
}));

const { RolesRepository } = await import('../roles.repository');

function roleDto(overrides: Record<string, unknown> = {}) {
  return {
    id: 'role-1',
    name: 'Content Lead',
    description: 'Manages content',
    isSystem: false,
    organizationId: 'organization-1',
    permissions: [{ action: 'read', subject: 'Member' }],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('RolesRepository', () => {
  let repository: InstanceType<typeof RolesRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new RolesRepository();
  });

  it('maps the paginated API response into role entities', async () => {
    rolesApi.findAll.mockResolvedValue({
      data: [roleDto()],
      meta: { total: 1, page: 1, limit: 100, totalPages: 1 },
    });

    const page = await repository.findAll({
      search: 'content',
      page: 2,
      limit: 8,
    });

    expect(rolesApi.findAll).toHaveBeenCalledWith('content', 8, 2);
    expect(page.data[0]).toMatchObject({
      name: 'Content Lead',
      organizationId: 'organization-1',
    });
    expect(page.data[0].createdAt).toBeInstanceOf(Date);
  });

  it('maps a failed list request onto the roles client error catalog', async () => {
    rolesApi.findAll.mockRejectedValue(new Error('network down'));

    await expect(repository.findAll()).rejects.toMatchObject({
      code: RolesErrors.FETCH_LIST_FAILED.code,
    });
  });
});
