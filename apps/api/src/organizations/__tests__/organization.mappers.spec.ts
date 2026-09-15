import { describe, expect, it } from 'vitest';
import {
  mapFullOrganization,
  mapInvitation,
  mapInvitations,
  mapMember,
  mapMembers,
  mapOrganization,
  mapOrganizations,
  mapPendingInvitations,
  mapWorkspace,
  mapWorkspaceMember,
  mapWorkspaceMembers,
  mapWorkspaces,
} from '../organization.mappers';

describe('mapOrganization', () => {
  it('maps an organization record', () => {
    const createdAt = new Date('2024-01-01T00:00:00.000Z');
    const result = mapOrganization({
      id: 'org1',
      name: 'Acme',
      slug: 'acme',
      logo: 'logo.png',
      metadata: { plan: 'pro' },
      createdAt,
    });

    expect(result).toEqual({
      id: 'org1',
      name: 'Acme',
      slug: 'acme',
      logo: 'logo.png',
      metadata: { plan: 'pro' },
      createdAt,
    });
  });

  it('defaults logo and metadata to null', () => {
    const result = mapOrganization({
      id: 'org1',
      name: 'Acme',
      slug: 'acme',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    expect(result.logo).toBeNull();
    expect(result.metadata).toBeNull();
  });

  it('parses metadata provided as a JSON string', () => {
    const result = mapOrganization({
      id: 'org1',
      name: 'Acme',
      slug: 'acme',
      metadata: '{"plan":"enterprise"}',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    expect(result.metadata).toEqual({ plan: 'enterprise' });
  });

  it('returns null metadata for an unparseable JSON string', () => {
    const result = mapOrganization({
      id: 'org1',
      name: 'Acme',
      slug: 'acme',
      metadata: '{not json',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    expect(result.metadata).toBeNull();
  });
});

describe('mapMember', () => {
  it('maps a member record and coerces ids to strings', () => {
    const result = mapMember({
      id: 1,
      organizationId: 2,
      userId: 3,
      role: 'owner',
      createdAt: '2024-01-01T00:00:00.000Z',
    });

    expect(result).toMatchObject({
      id: '1',
      organizationId: '2',
      userId: '3',
      role: 'owner',
    });
    expect(result.createdAt).toBeInstanceOf(Date);
  });
});

describe('mapInvitation', () => {
  it('maps an invitation with all fields', () => {
    const result = mapInvitation({
      id: 'inv1',
      organizationId: 'org1',
      email: 'invitee@x.com',
      role: 'member',
      status: 'pending',
      teamId: 'team1',
      inviterId: 'u1',
      expiresAt: '2024-02-01T00:00:00.000Z',
      createdAt: '2024-01-01T00:00:00.000Z',
    });

    expect(result).toMatchObject({
      id: 'inv1',
      organizationId: 'org1',
      email: 'invitee@x.com',
      role: 'member',
      status: 'pending',
      teamId: 'team1',
      inviterId: 'u1',
    });
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it('defaults role and teamId to null when absent', () => {
    const result = mapInvitation({
      id: 'inv1',
      organizationId: 'org1',
      email: 'invitee@x.com',
      status: 'pending',
      inviterId: 'u1',
      expiresAt: '2024-02-01T00:00:00.000Z',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    expect(result.role).toBeNull();
    expect(result.teamId).toBeNull();
  });
});

describe('mapWorkspace', () => {
  it('maps a workspace (team) record', () => {
    const result = mapWorkspace({
      id: 'team1',
      name: 'Engineering',
      organizationId: 'org1',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    });

    expect(result).toMatchObject({
      id: 'team1',
      name: 'Engineering',
      organizationId: 'org1',
    });
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });

  it('maps a missing updatedAt to null', () => {
    const result = mapWorkspace({
      id: 'team1',
      name: 'Engineering',
      organizationId: 'org1',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    expect(result.updatedAt).toBeNull();
  });
});

describe('mapWorkspaceMember', () => {
  it('maps a team-member record', () => {
    const result = mapWorkspaceMember({
      id: 'tm1',
      teamId: 'team1',
      userId: 'u1',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    expect(result).toMatchObject({ id: 'tm1', teamId: 'team1', userId: 'u1' });
    expect(result.createdAt).toBeInstanceOf(Date);
  });
});

describe('mapFullOrganization', () => {
  it('maps an organization with nested members, invitations, and teams', () => {
    const result = mapFullOrganization({
      id: 'org1',
      name: 'Acme',
      slug: 'acme',
      createdAt: '2024-01-01T00:00:00.000Z',
      members: [
        {
          id: 'm1',
          organizationId: 'org1',
          userId: 'u1',
          role: 'owner',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      invitations: [
        {
          id: 'inv1',
          organizationId: 'org1',
          email: 'x@y.com',
          status: 'pending',
          inviterId: 'u1',
          expiresAt: '2024-02-01T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      teams: [{ id: 'team1', name: 'Eng' }],
    });

    expect(result.id).toBe('org1');
    expect(result.members).toHaveLength(1);
    expect(result.invitations).toHaveLength(1);
    expect(result.teams).toEqual([{ id: 'team1', name: 'Eng' }]);
  });

  it('defaults nested collections to empty arrays', () => {
    const result = mapFullOrganization({
      id: 'org1',
      name: 'Acme',
      slug: 'acme',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    expect(result.members).toEqual([]);
    expect(result.invitations).toEqual([]);
    expect(result.teams).toEqual([]);
  });
});

describe('mapPendingInvitations', () => {
  const invitation = (status: string) => ({
    id: `inv-${status}`,
    organizationId: 'org1',
    email: `${status}@x.com`,
    role: 'member',
    status,
    inviterId: 'u1',
    expiresAt: '2024-02-01T00:00:00.000Z',
    createdAt: '2024-01-01T00:00:00.000Z',
  });

  it('keeps only pending invitations and drops resolved ones', () => {
    // Better Auth returns cancelled/rejected rows from listInvitations; the
    // pending list must not surface them.
    const result = mapPendingInvitations([
      invitation('pending'),
      invitation('canceled'),
      invitation('rejected'),
      invitation('accepted'),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('pending');
  });

  it('tolerates a non-array', () => {
    expect(mapPendingInvitations('nope')).toEqual([]);
  });
});

describe('array mappers', () => {
  it('mapOrganizations maps a list and tolerates a non-array', () => {
    expect(
      mapOrganizations([
        {
          id: 'o1',
          name: 'A',
          slug: 'a',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ]),
    ).toHaveLength(1);
    expect(mapOrganizations(null)).toEqual([]);
  });

  it('mapMembers, mapInvitations, mapWorkspaces, mapWorkspaceMembers tolerate non-arrays', () => {
    expect(mapMembers(undefined)).toEqual([]);
    expect(mapInvitations('nope')).toEqual([]);
    expect(mapWorkspaces({})).toEqual([]);
    expect(mapWorkspaceMembers(null)).toEqual([]);
  });
});
