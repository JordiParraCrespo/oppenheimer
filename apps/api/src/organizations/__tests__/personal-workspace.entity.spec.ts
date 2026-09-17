import { ArgumentInvalidException, ArgumentNotProvidedException } from '@oppenheimer/backend-ddd';
import { describe, expect, it } from 'vitest';
import { PersonalWorkspaceProvisionedDomainEvent } from '../domain/events/personal-workspace-provisioned.domain-event';
import { PersonalWorkspaceEntity } from '../domain/personal-workspace.entity';
import { OrganizationSlug } from '../domain/value-objects/organization-slug.value-object';

const OWNER_ROLE_ID = 'owner-role-uuid';

function provision(overrides: { ownerEmail?: string; ownerName?: string | null } = {}) {
  return PersonalWorkspaceEntity.provisionFor({
    ownerId: 'user-uuid',
    ownerEmail: overrides.ownerEmail ?? 'ada@example.com',
    ownerName: overrides.ownerName === undefined ? 'Ada Lovelace' : overrides.ownerName,
    ownerRoleId: OWNER_ROLE_ID,
  });
}

describe('OrganizationSlug', () => {
  it('derives a readable slug with a uniqueness suffix', () => {
    expect(OrganizationSlug.derive('Ada Lovelace').value).toMatch(/^ada-lovelace-[0-9a-f]{8}$/);
  });

  it('never returns the same slug twice for the same name', () => {
    const first = OrganizationSlug.derive('Ada Lovelace').value;
    const second = OrganizationSlug.derive('Ada Lovelace').value;
    expect(first).not.toBe(second);
  });

  it('still yields a usable slug when nothing in the name survives slugification', () => {
    expect(OrganizationSlug.derive('***').value).toMatch(/^workspace-[0-9a-f]{8}$/);
  });

  it('does not leave a trailing hyphen when the length cap lands on one', () => {
    // 32 characters of name, the 32nd being the separator the cap would keep.
    const value = OrganizationSlug.derive('abcdefghijklmnopqrstuvwxyzabcde f').value;
    expect(value).not.toContain('--');
    expect(value).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('rejects a slug that is not URL-safe', () => {
    expect(() => new OrganizationSlug({ value: 'Not A Slug' })).toThrow(ArgumentInvalidException);
  });
});

describe('PersonalWorkspaceEntity', () => {
  it('names the workspace after the account', () => {
    const workspace = provision();

    expect(workspace.name).toBe('Ada Lovelace');
    expect(workspace.slug.value).toMatch(/^ada-lovelace-/);
    expect(workspace.ownerId).toBe('user-uuid');
    expect(workspace.ownerRoleId).toBe(OWNER_ROLE_ID);
  });

  it('falls back to the local part of the email when the account has no name', () => {
    expect(provision({ ownerName: null }).name).toBe('ada');
    expect(provision({ ownerName: '   ' }).name).toBe('ada');
  });

  it('gives the membership its own identity, distinct from the organization', () => {
    const workspace = provision();

    expect(workspace.membershipId).toBeTruthy();
    expect(workspace.membershipId).not.toBe(workspace.id);
  });

  it('raises the provisioning event, with a reason naming the account', () => {
    const workspace = provision();

    expect(workspace.domainEvents).toHaveLength(1);
    const [event] = workspace.domainEvents;
    expect(event).toBeInstanceOf(PersonalWorkspaceProvisionedDomainEvent);
    expect(event).toMatchObject({
      aggregateId: workspace.id,
      ownerId: 'user-uuid',
      name: 'Ada Lovelace',
      slug: workspace.slug.value,
    });
    expect(event.reason).toContain('ada@example.com');
  });

  it('refuses a workspace whose owner could not open it', () => {
    expect(() =>
      PersonalWorkspaceEntity.provisionFor({
        ownerId: 'user-uuid',
        ownerEmail: 'ada@example.com',
        ownerName: 'Ada Lovelace',
        ownerRoleId: '',
      }),
    ).toThrow(ArgumentNotProvidedException);
  });

  it('refuses a workspace with no owner', () => {
    expect(() =>
      PersonalWorkspaceEntity.provisionFor({
        ownerId: '',
        ownerEmail: 'ada@example.com',
        ownerName: 'Ada Lovelace',
        ownerRoleId: OWNER_ROLE_ID,
      }),
    ).toThrow(ArgumentNotProvidedException);
  });
});
