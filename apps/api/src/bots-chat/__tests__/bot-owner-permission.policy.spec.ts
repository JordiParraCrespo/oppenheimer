import { SCOPES } from '@oppenheimer/shared';
import { ownerLacksPermission, permissionName } from '../domain/bot-owner-permission.policy';

/**
 * The refusal a bot reads when its owner's roles do not cover a tool: it
 * names the permission as the permission picker does, so the person knows
 * what to ask for, and tells the bot nothing ran and not to go around it.
 */
describe('the owner permission refusal', () => {
  it('names the permission as the picker does, and every catalog scope has a name', () => {
    expect(permissionName('pulls:write')).toBe('Pull requests: Review');
    for (const scope of SCOPES) expect(permissionName(scope)).not.toBe(scope);
  });

  it('says nothing ran, which permission is missing, and to ask for it rather than work around it', () => {
    const words = ownerLacksPermission('merge_pull_request', 'pulls:write');

    expect(words).toMatch(/^Not run:/);
    expect(words).toContain('"Pull requests: Review" permission (pulls:write)');
    expect(words).toContain('granted');
    expect(words).toContain('Do not try to do it another way');
  });
});
