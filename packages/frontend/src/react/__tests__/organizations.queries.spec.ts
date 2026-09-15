import { describe, expect, it } from 'vitest';
import { organizationsKeys } from '../organizations.queries';

/**
 * The member list is now narrowed by the server, which makes its cache key a
 * correctness concern rather than a detail: what a mutation can invalidate is
 * exactly what prefixes exist.
 */
describe('organizationsKeys.members', () => {
  const ORG = 'org-1';
  const prefixOf = (key: readonly unknown[], length: number) => key.slice(0, length);

  it('nests from generic to specific', () => {
    expect(organizationsKeys.all).toEqual(['organizations']);
    expect(organizationsKeys.membersAll()).toEqual(['organizations', 'members']);
    expect(organizationsKeys.members(ORG)).toEqual(['organizations', 'members', ORG]);
  });

  it('keeps the unnarrowed key a prefix of every narrowed one', () => {
    // Removing a member invalidates `members(orgId)`. TanStack matches by
    // prefix, so anything below has to extend that key rather than diverge from
    // it — or a removed member stays on screen until the reader clears the box.
    const unnarrowed = organizationsKeys.members(ORG);

    for (const filters of [
      { search: 'ada' },
      { roleIds: ['role-a'] },
      { search: 'ada', roleIds: ['role-a', 'role-b'] },
    ]) {
      const narrowed = organizationsKeys.members(ORG, filters);
      expect(prefixOf(narrowed, unnarrowed.length)).toEqual([...unnarrowed]);
    }
  });

  it('puts every organization under one invalidatable prefix', () => {
    // `useAssignUserRoles` knows the user whose roles changed, not the
    // workspaces they belong to — so it needs a prefix that spans all of them.
    const prefix = organizationsKeys.membersAll();

    for (const org of [ORG, 'org-2']) {
      const key = organizationsKeys.members(org, { roleIds: ['role-a'] });
      expect(prefixOf(key, prefix.length)).toEqual([...prefix]);
    }
  });

  it('asks the same question once however the roles were picked', () => {
    // The facet appends in click order; an unsorted key would fetch the same
    // answer twice and cache it under two entries.
    expect(organizationsKeys.members(ORG, { roleIds: ['b', 'a'] })).toEqual(
      organizationsKeys.members(ORG, { roleIds: ['a', 'b'] }),
    );
  });

  it('treats an empty facet as no facet', () => {
    expect(organizationsKeys.members(ORG, { roleIds: [] })).toEqual(organizationsKeys.members(ORG));
    expect(organizationsKeys.members(ORG, { search: '' })).toEqual(organizationsKeys.members(ORG));
  });

  it('separates two different narrowings', () => {
    expect(organizationsKeys.members(ORG, { roleIds: ['a'] })).not.toEqual(
      organizationsKeys.members(ORG, { roleIds: ['b'] }),
    );
    expect(organizationsKeys.members(ORG, { search: 'ada' })).not.toEqual(
      organizationsKeys.members(ORG, { search: 'bob' }),
    );
    expect(organizationsKeys.members(ORG)).not.toEqual(organizationsKeys.members('org-2'));
  });

  it('does not collide with the organization list', () => {
    expect(organizationsKeys.membersAll()).not.toEqual(organizationsKeys.lists());
  });
});
