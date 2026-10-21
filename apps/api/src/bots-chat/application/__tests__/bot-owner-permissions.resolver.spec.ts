import { emptyScope } from '@oppenheimer/backend-authz';
import { defineAbilitiesFromPermissions } from '@oppenheimer/shared';
import type { AbilityFactory } from '../../../roles/application/ability.factory';
import { BotOwnerPermissionsResolver } from '../bot-owner-permissions.resolver';

/**
 * What a bot may do is what its owner's roles let them grant a token, in
 * the bot's workspace, and never the platform tier: the owner's ability is
 * built as an ordinary account (`user`), so an administrator's bot is not an
 * administrator. The ability itself is the roles module's.
 */
describe('BotOwnerPermissionsResolver', () => {
  it('holds a write scope only when the owner’s roles grant it, built in the bot’s workspace as a plain user', async () => {
    const createForUser = vi.fn(async () =>
      defineAbilitiesFromPermissions([{ action: 'read', subject: 'PullRequest' }], {
        user: { id: 'owner-1' },
        activeOrganizationId: 'org-1',
        activeTeamId: null,
      }),
    );
    const resolver = new BotOwnerPermissionsResolver({
      createForUser,
    } as unknown as AbilityFactory);

    const held = await resolver.heldScopes(emptyScope('owner-1', 'org-1'));

    expect(held.has('pulls:read')).toBe(true);
    expect(held.has('pulls:write')).toBe(false);
    expect(createForUser).toHaveBeenCalledWith(
      { id: 'owner-1', role: 'user' },
      { organizationId: 'org-1' },
    );
  });
});
