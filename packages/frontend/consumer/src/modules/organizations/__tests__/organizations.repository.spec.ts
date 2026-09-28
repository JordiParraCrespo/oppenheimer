import { AppError } from '@oppenheimer/frontend-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationsErrors } from '../organizations.errors';

/**
 * The organizations repository shapes the personal workspace, and one of its
 * decisions is load-bearing rather than incidental: an absent body is a
 * *failed read*, never an empty collection. Returning `[]` renders "no
 * workspace" over a request that never succeeded, which sends the reader to
 * onboarding for a network blip.
 */

const organizations = vi.hoisted(() => ({
  listOrganizations: vi.fn(),
  createOrganization: vi.fn(),
  updateOrganization: vi.fn(),
}));

vi.mock('@oppenheimer/api-client', () => ({ heyApiSdk: organizations }));

/** A generated SDK call's result: the body, and no error. */
function ok(data: unknown) {
  return { data, error: undefined, response: new Response(null, { status: 200 }) };
}

const { OrganizationsRepository } = await import('../organizations.repository');

/** A response as the API actually sends it: dates are ISO strings. */
function organizationDto(overrides: Record<string, unknown> = {}) {
  return {
    id: 'org-acme',
    name: 'Acme',
    slug: 'acme',
    logo: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('OrganizationsRepository', () => {
  let repository: InstanceType<typeof OrganizationsRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new OrganizationsRepository();
  });

  describe('findAll', () => {
    it('maps the response into entities, parsing the dates', async () => {
      organizations.listOrganizations.mockResolvedValue(ok([organizationDto()]));

      const [organization] = await repository.findAll();

      expect(organization.id).toBe('org-acme');
      expect(organization.name).toBe('Acme');
      expect(organization.slug).toBe('acme');
      expect(organization.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    });

    it('normalises an absent logo to null', async () => {
      organizations.listOrganizations.mockResolvedValue(ok([organizationDto({ logo: undefined })]));

      expect((await repository.findAll())[0].logo).toBeNull();
    });

    it('returns an empty list for an empty response body', async () => {
      // `[]` from the server genuinely is no organizations, and must not be
      // confused with the failure below.
      organizations.listOrganizations.mockResolvedValue(ok([]));

      await expect(repository.findAll()).resolves.toEqual([]);
    });

    it('treats an absent body as a failed read, not an empty collection', async () => {
      organizations.listOrganizations.mockResolvedValue(ok(undefined));

      const error = await repository.findAll().catch((thrown: AppError) => thrown);

      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(OrganizationsErrors.FETCH_LIST_FAILED.code);
    });
  });

  it('creates an organization and maps the reply into an entity', async () => {
    organizations.createOrganization.mockResolvedValue(
      ok({
        id: 'org-2',
        name: 'Acme',
        slug: 'acme',
        logo: null,
        metadata: null,
        createdAt: '2026-08-01T00:00:00.000Z',
      }),
    );

    const created = await repository.create({ name: 'Acme', slug: 'acme' });

    expect(organizations.createOrganization).toHaveBeenCalledWith({
      body: { name: 'Acme', slug: 'acme' },
    });
    expect(created).toMatchObject({ id: 'org-2', name: 'Acme', slug: 'acme', logo: null });
    expect(created.createdAt).toBeInstanceOf(Date);
  });

  it('treats an absent reply to a create as a failure', async () => {
    organizations.createOrganization.mockResolvedValue(ok(undefined));

    const error = await repository.create({ name: 'Acme' }).catch((e) => e as AppError);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(OrganizationsErrors.CREATE_FAILED.code);
  });
});
