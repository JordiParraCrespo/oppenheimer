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
  // A stand-in that behaves as `MembershipAccessPolicy.admit` does (its own
  // spec holds it to that): write, grant, and undo the write if the grant fails.
  const membershipAccess = { admit: vi.fn() };
  const grant = vi.fn();
  const events = { emitAsync: vi.fn() };
  let handler: CreateOrganizationCommandHandler;

  const create = (input: { name: string; slug?: string }, creatorId?: string) =>
    handler.execute(new CreateOrganizationCommand({ headers, input, creatorId }));

  beforeEach(() => {
    vi.clearAllMocks();
    organizations.create.mockResolvedValue(organization);
    organizations.delete.mockResolvedValue(organization);
    workspaces.create.mockResolvedValue({ id: 'team1' });
    grant.mockResolvedValue(undefined);
    membershipAccess.admit.mockImplementation(async (write, undo) => {
      const entry = await write();
      try {
        await grant(entry);
      } catch (error) {
        await undo(entry).catch(() => {});
        throw error;
      }
      return entry;
    });
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
    expect(organizations.create.mock.calls[0][1].slug).toMatch(/^my-great-org-[0-9a-f]{8}$/);
  });

  // "workspace", not the "org" this used to say: the slug rule is one value
  // object shared with the personal workspace sign-up provisions.
  it('falls back to "workspace" when the name has no alphanumerics', async () => {
    await create({ name: '***' });
    expect(organizations.create.mock.calls[0][1].slug).toMatch(/^workspace-[0-9a-f]{8}$/);
  });

  it('touches no roles and makes no workspace without an authenticated creator', async () => {
    const id = await create({ name: 'Acme' });

    expect(id).toBe('org1');
    expect(membershipAccess.admit).not.toHaveBeenCalled();
    expect(workspaces.create).not.toHaveBeenCalled();
  });

  /**
   * The bug this exists to stop: Better Auth's `owner` membership is not what
   * the app's routes check, so an organization created without the org-scoped
   * application role is one its creator owns and cannot read.
   */
  it('grants the creator the org-scoped role that opens the organization', async () => {
    await create({ name: 'Acme' }, 'u1');
    expect(grant).toHaveBeenCalledWith({ userId: 'u1', organizationId: 'org1', role: 'owner' });
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

  // Its own event, not sign-up's: an organization made from the console is
  // not a personal workspace, though both get an Unassigned project.
  it('announces the organization it created', async () => {
    await create({ name: 'Acme' }, 'u1');
    expect(events.emitAsync).toHaveBeenCalledWith(
      'OrganizationCreatedDomainEvent',
      expect.objectContaining({ aggregateId: 'org1', creatorId: 'u1' }),
    );
  });

  it('discards the organization when the role that opens it cannot be written', async () => {
    const failure = new Error('role store unavailable');
    grant.mockRejectedValueOnce(failure);

    await expect(create({ name: 'Acme' }, 'u1')).rejects.toBe(failure);

    expect(organizations.delete).toHaveBeenCalledWith(headers, 'org1');
    // No half-built organization left behind for the caller to trip over.
    expect(workspaces.create).not.toHaveBeenCalled();
  });

  it('reports the original failure even when the cleanup itself fails', async () => {
    const failure = new Error('role store unavailable');
    grant.mockRejectedValueOnce(failure);
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

    expect(await create({ name: 'Acme' }, 'u1')).toBe('org1');
    expect(grant).toHaveBeenCalledOnce();
  });

  it('still returns the organization when a listener fails', async () => {
    events.emitAsync.mockRejectedValue(new Error('listener down'));
    expect(await create({ name: 'Acme' }, 'u1')).toBe('org1');
  });
});
