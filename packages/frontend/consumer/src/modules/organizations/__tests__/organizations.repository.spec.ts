import { AppError } from '@oppenheimer/frontend-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationsErrors } from '../organizations.errors';

/**
 * The organizations repository is where the team screen's data is shaped, and
 * two of its decisions are load-bearing rather than incidental:
 *
 *  - an absent body is a *failed read*, never an empty collection. Returning
 *    `[]` renders "no members" over a request that never succeeded, which reads
 *    to an admin as everyone having been removed.
 *  - an empty role facet is *no facet*. Sending `roleIds=[]` asks the server for
 *    members holding none of no roles, and the table comes back empty.
 *
 * Both are the kind of thing that looks like a rendering bug from the outside.
 */

const organizations = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  setActive: vi.fn(),
}));
const members = vi.hoisted(() => ({
  list: vi.fn(),
  updateRole: vi.fn(),
  remove: vi.fn(),
}));
const orgInvitations = vi.hoisted(() => ({ list: vi.fn(), invite: vi.fn() }));
const invitations = vi.hoisted(() => ({
  cancel: vi.fn(),
  accept: vi.fn(),
  listMine: vi.fn(),
}));

vi.mock('@oppenheimer/api-client', () => ({
  OrganizationsApi: organizations,
  OrganizationMembersApi: members,
  OrganizationInvitationsApi: orgInvitations,
  InvitationsApi: invitations,
}));

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

function memberDto(overrides: Record<string, unknown> = {}) {
  return {
    id: 'member-1',
    organizationId: 'org-acme',
    userId: 'user-1',
    role: 'owner',
    createdAt: '2026-02-01T00:00:00.000Z',
    user: {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      image: null,
      isActive: true,
      emailVerified: true,
    },
    ...overrides,
  };
}

function invitationDto(overrides: Record<string, unknown> = {}) {
  return {
    id: 'invitation-1',
    organizationId: 'org-acme',
    email: 'grace@example.com',
    role: 'member',
    status: 'pending',
    expiresAt: '2026-03-01T00:00:00.000Z',
    createdAt: '2026-02-01T00:00:00.000Z',
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
      organizations.list.mockResolvedValue([organizationDto()]);

      const [organization] = await repository.findAll();

      expect(organization.id).toBe('org-acme');
      expect(organization.name).toBe('Acme');
      expect(organization.slug).toBe('acme');
      expect(organization.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    });

    it('normalises an absent logo to null', async () => {
      organizations.list.mockResolvedValue([organizationDto({ logo: undefined })]);

      expect((await repository.findAll())[0].logo).toBeNull();
    });

    it('returns an empty list for an empty response body', async () => {
      // `[]` from the server genuinely is no organizations, and must not be
      // confused with the failure below.
      organizations.list.mockResolvedValue([]);

      await expect(repository.findAll()).resolves.toEqual([]);
    });

    it('treats an absent body as a failed read, not an empty collection', async () => {
      organizations.list.mockResolvedValue(undefined);

      const error = await repository.findAll().catch((thrown: AppError) => thrown);

      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(OrganizationsErrors.FETCH_LIST_FAILED.code);
    });
  });

  describe('findMembers', () => {
    it('maps members, taking the display fields from the nested user', async () => {
      members.list.mockResolvedValue([memberDto()]);

      const [member] = await repository.findMembers('org-acme');

      expect(member.name).toBe('Ada Lovelace');
      expect(member.email).toBe('ada@example.com');
      expect(member.organizationRole).toBe('owner');
      expect(member.joinedAt).toEqual(new Date('2026-02-01T00:00:00.000Z'));
    });

    it('falls back to the email local part when a member has no name', async () => {
      // A row with a blank name column reads as a rendering bug. The local part
      // is a worse label than a name and a much better one than nothing.
      members.list.mockResolvedValue([
        memberDto({
          user: {
            name: '',
            email: 'grace@example.com',
            image: null,
            isActive: true,
            emailVerified: false,
          },
        }),
      ]);

      expect((await repository.findMembers('org-acme'))[0].name).toBe('grace');
    });

    it('falls back to the user id when there is no nested user at all', async () => {
      members.list.mockResolvedValue([memberDto({ user: undefined })]);

      const [member] = await repository.findMembers('org-acme');

      expect(member.name).toBe('user-1');
      expect(member.email).toBe('');
    });

    it('assumes an active, unverified user when the nested user is missing', async () => {
      // Defaults chosen so a missing join does not render someone as
      // deactivated — a state the admin would then try to undo.
      members.list.mockResolvedValue([memberDto({ user: undefined })]);

      const [member] = await repository.findMembers('org-acme');

      expect(member.isActive).toBe(true);
      expect(member.emailVerified).toBe(false);
    });

    describe('the role facet', () => {
      it('sends an empty facet as undefined, not as an empty array', async () => {
        // `roleIds=[]` asks for members holding none of no roles, and the table
        // comes back empty — which reads as the facet being broken.
        members.list.mockResolvedValue([]);

        await repository.findMembers('org-acme', { roleIds: [] });

        expect(members.list).toHaveBeenCalledWith('org-acme', undefined, undefined);
      });

      it('sends the ids when the facet holds any', async () => {
        members.list.mockResolvedValue([]);

        await repository.findMembers('org-acme', {
          roleIds: ['role-1', 'role-2'],
        });

        expect(members.list).toHaveBeenCalledWith('org-acme', ['role-1', 'role-2'], undefined);
      });

      it('sends the search term to the server rather than filtering here', async () => {
        // Narrowing after the response trims the page on screen and leaves
        // every other match on a page nobody opens.
        members.list.mockResolvedValue([]);

        await repository.findMembers('org-acme', { search: 'ada' });

        expect(members.list).toHaveBeenCalledWith('org-acme', undefined, 'ada');
      });
    });

    it('treats an absent body as a failed read', async () => {
      members.list.mockResolvedValue(undefined);

      await expect(repository.findMembers('org-acme')).rejects.toBeInstanceOf(AppError);
    });
  });

  describe('invitations', () => {
    it('maps an invitation, parsing both timestamps', async () => {
      orgInvitations.list.mockResolvedValue([invitationDto()]);

      const [invitation] = await repository.findInvitations('org-acme');

      expect(invitation.email).toBe('grace@example.com');
      expect(invitation.status).toBe('pending');
      expect(invitation.expiresAt).toEqual(new Date('2026-03-01T00:00:00.000Z'));
      expect(invitation.createdAt).toEqual(new Date('2026-02-01T00:00:00.000Z'));
    });

    it('defaults a missing role to member', async () => {
      // The least privileged reading. Defaulting the other way would show a
      // pending invitation as an incoming owner.
      orgInvitations.list.mockResolvedValue([invitationDto({ role: undefined })]);

      expect((await repository.findInvitations('org-acme'))[0].organizationRole).toBe('member');
    });

    it('maps the invitation it just created', async () => {
      orgInvitations.invite.mockResolvedValue(invitationDto());

      const invitation = await repository.invite('org-acme', {
        email: 'grace@example.com',
        role: 'member',
      });

      expect(invitation.id).toBe('invitation-1');
    });

    it('fails rather than returning nothing when accept answers with no body', async () => {
      invitations.accept.mockResolvedValue(undefined);

      await expect(repository.acceptInvitation('invitation-1')).rejects.toBeInstanceOf(AppError);
    });
  });

  describe('writes with no response body', () => {
    it('resolves after removing a member', async () => {
      // 204 is the success shape here, so an absent body must not be read as
      // the failure it is on the read paths above.
      members.remove.mockResolvedValue(undefined);

      await expect(repository.removeMember('org-acme', 'member-1')).resolves.toBeUndefined();
      expect(members.remove).toHaveBeenCalledWith('org-acme', 'member-1');
    });

    it('resolves after cancelling an invitation', async () => {
      invitations.cancel.mockResolvedValue(undefined);

      await expect(repository.cancelInvitation('invitation-1')).resolves.toBeUndefined();
    });
  });

  describe('updateMemberRole', () => {
    it('sends the role in the body the endpoint expects', async () => {
      members.updateRole.mockResolvedValue(memberDto({ role: 'admin' }));

      const member = await repository.updateMemberRole('org-acme', 'member-1', 'admin');

      expect(members.updateRole).toHaveBeenCalledWith('org-acme', 'member-1', {
        role: 'admin',
      });
      expect(member.organizationRole).toBe('admin');
    });
  });

  describe('findMyInvitations', () => {
    it("maps the caller's own invitations, parsing the dates", async () => {
      invitations.listMine.mockResolvedValue([invitationDto()]);

      const [invitation] = await repository.findMyInvitations();

      expect(invitation.id).toBe('invitation-1');
      expect(invitation.organizationRole).toBe('member');
      expect(invitation.expiresAt).toEqual(new Date('2026-03-01T00:00:00.000Z'));
    });

    it('returns an empty list for an empty response body', async () => {
      invitations.listMine.mockResolvedValue([]);

      await expect(repository.findMyInvitations()).resolves.toEqual([]);
    });

    it('treats an absent body as a failed read, not "you were never invited"', async () => {
      // This list is the only thing an account with no workspace can act on;
      // rendering "no invitations yet" over a request that never succeeded
      // reads as having been forgotten.
      invitations.listMine.mockResolvedValue(undefined);

      const error = await repository.findMyInvitations().catch((thrown: AppError) => thrown);

      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(OrganizationsErrors.FETCH_MY_INVITATIONS_FAILED.code);
    });
  });

  describe('setActive', () => {
    it('maps the organization the session switched to', async () => {
      organizations.setActive.mockResolvedValue(organizationDto({ id: 'org-other' }));

      expect((await repository.setActive('org-other')).id).toBe('org-other');
    });

    it('fails on an absent body rather than returning a half-built entity', async () => {
      organizations.setActive.mockResolvedValue(undefined);

      await expect(repository.setActive('org-other')).rejects.toBeInstanceOf(AppError);
    });
  });

  it('creates an organization and maps the reply into an entity', async () => {
    organizations.create.mockResolvedValue({
      id: 'org-2',
      name: 'Acme',
      slug: 'acme',
      logo: null,
      metadata: null,
      createdAt: '2026-08-01T00:00:00.000Z',
    });

    const created = await repository.create({ name: 'Acme', slug: 'acme' });

    expect(organizations.create).toHaveBeenCalledWith({ name: 'Acme', slug: 'acme' });
    expect(created).toMatchObject({ id: 'org-2', name: 'Acme', slug: 'acme', logo: null });
    expect(created.createdAt).toBeInstanceOf(Date);
  });

  it('treats an absent reply to a create as a failure', async () => {
    organizations.create.mockResolvedValue(undefined);

    const error = await repository.create({ name: 'Acme' }).catch((e) => e as AppError);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(OrganizationsErrors.CREATE_FAILED.code);
  });
});
