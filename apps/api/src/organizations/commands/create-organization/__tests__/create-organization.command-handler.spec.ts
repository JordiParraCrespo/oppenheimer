import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateOrganizationCommand } from '../create-organization.command';
import { CreateOrganizationCommandHandler } from '../create-organization.command-handler';

const headers = { cookie: 'session=abc' };
const organization = {
  id: 'org1',
  name: 'Acme',
  slug: 'acme',
  logo: null,
  metadata: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
};

describe('CreateOrganizationCommandHandler', () => {
  const organizations = {
    create: vi.fn(),
    delete: vi.fn(),
  };
  const workspaces = {
    create: vi.fn(),
    addMember: vi.fn(),
    setActive: vi.fn(),
  };
  const membershipAccess = { grant: vi.fn() };
  const events = { emitAsync: vi.fn() };
  let handler: CreateOrganizationCommandHandler;

  const create = (input: { name: string; slug?: string }, creatorId?: string) =>
    handler.execute(new CreateOrganizationCommand({ headers, input, creatorId }));

  beforeEach(() => {
    vi.clearAllMocks();
    organizations.create.mockResolvedValue(organization);
    organizations.delete.mockResolvedValue(organization);
    workspaces.create.mockResolvedValue({ id: 'team1' });
    membershipAccess.grant.mockResolvedValue(undefined);
    events.emitAsync.mockResolvedValue([]);
    handler = new CreateOrganizationCommandHandler(
      organizations as never,
      workspaces as never,
      membershipAccess as never,
      events as never,
    );
  });

  it('uses the provided slug', async () => {
    await create({ name: 'Acme', slug: 'custom-slug' });
    expect(organizations.create.mock.calls[0][1].slug).toBe('custom-slug');
  });

  it('generates a slug from the name when none is provided', async () => {
    await create({ name: 'My Great Org!' });
    // slugified base + '-' + 8 hex chars
    expect(organizations.create.mock.calls[0][1].slug).toMatch(/^my-great-org-[0-9a-f]{8}$/);
  });

  // "workspace", not the "org" this used to say: the slug rule is one value
  // object shared with the personal workspace sign-up provisions.
  it('falls back to "workspace" when the name has no alphanumerics', async () => {
    await create({ name: '***' });
    expect(organizations.create.mock.calls[0][1].slug).toMatch(/^workspace-[0-9a-f]{8}$/);
  });

  it('touches no roles and makes no workspace without an authenticated creator', async () => {
    const result = await create({ name: 'Acme' });

    expect(result.id).toBe('org1');
    expect(membershipAccess.grant).not.toHaveBeenCalled();
    expect(workspaces.create).not.toHaveBeenCalled();
  });

  /**
   * The bug this exists to stop: Better Auth's `owner` membership is not what
   * the app's routes check, so an organization created without the org-scoped
   * application role is one its creator owns and cannot read.
   */
  it('grants the creator the org-scoped role that opens the organization', async () => {
    await create({ name: 'Acme' }, 'u1');
    expect(membershipAccess.grant).toHaveBeenCalledWith('u1', 'org1', 'owner');
  });

  it('gives the organization a default workspace with its creator in it', async () => {
    await create({ name: 'Acme' }, 'u1');

    expect(workspaces.create).toHaveBeenCalledWith(headers, {
      name: 'General',
      organizationId: 'org1',
    });
    expect(workspaces.addMember).toHaveBeenCalledWith(headers, 'team1', 'u1');
    expect(workspaces.setActive).toHaveBeenCalledWith(headers, 'team1');
  });

  // The caller's own workspace, made on /onboarding: announced as sign-up's
  // is, so the projects module gives it its Unassigned project.
  it('announces the workspace it provisioned', async () => {
    await create({ name: 'Acme' }, 'u1');
    expect(events.emitAsync).toHaveBeenCalledWith(
      'PersonalWorkspaceProvisionedDomainEvent',
      expect.objectContaining({ aggregateId: 'org1' }),
    );
  });

  it('discards the organization when the role that opens it cannot be written', async () => {
    const failure = new Error('role store unavailable');
    membershipAccess.grant.mockRejectedValueOnce(failure);

    await expect(create({ name: 'Acme' }, 'u1')).rejects.toBe(failure);

    expect(organizations.delete).toHaveBeenCalledWith(headers, 'org1');
    // No half-built organization left behind for the caller to trip over.
    expect(workspaces.create).not.toHaveBeenCalled();
  });

  it('reports the original failure even when the cleanup itself fails', async () => {
    const failure = new Error('role store unavailable');
    membershipAccess.grant.mockRejectedValueOnce(failure);
    organizations.delete.mockRejectedValueOnce(new Error('delete failed too'));

    await expect(create({ name: 'Acme' }, 'u1')).rejects.toBe(failure);
  });

  /**
   * The workspace is a convenience; the organization and the role that opens
   * it are not. Failing the request when the team could not be made would tell
   * the caller the organization does not exist when it does.
   */
  it('still returns the organization when the default workspace cannot be made', async () => {
    workspaces.create.mockRejectedValue(new Error('teams are unavailable'));

    const result = await create({ name: 'Acme' }, 'u1');

    expect(result.id).toBe('org1');
    expect(membershipAccess.grant).toHaveBeenCalledWith('u1', 'org1', 'owner');
  });

  it('still returns the organization when a listener fails', async () => {
    events.emitAsync.mockRejectedValue(new Error('listener down'));
    expect((await create({ name: 'Acme' }, 'u1')).id).toBe('org1');
  });
});
