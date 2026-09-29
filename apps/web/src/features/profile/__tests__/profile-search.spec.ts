import { describe, expect, it } from 'vitest';
import { profileSearchSchema } from '../lib/profile-search';

/** `?emailChanged=1` is how the change-email link lands; the router re-reads it as `true`. */
describe('profileSearchSchema', () => {
  it('reads every spelling of the flag the link and the router write as on', () => {
    for (const emailChanged of ['1', 1, 'true', true]) {
      expect(profileSearchSchema.parse({ emailChanged })).toEqual({ emailChanged: true });
    }
  });

  it('reads anything else, or nothing, as absent', () => {
    for (const emailChanged of [undefined, '0', 'false', false, 'yes']) {
      expect(profileSearchSchema.parse({ emailChanged })).toEqual({ emailChanged: undefined });
    }
  });
});
