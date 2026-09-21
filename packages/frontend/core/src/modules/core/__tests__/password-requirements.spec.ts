import { PASSWORD_MIN_LENGTH } from '@oppenheimer/shared/constants';
import { describe, expect, it } from 'vitest';
import { checkPassword, meetsPasswordRequirements } from '../password-requirements';

/** Long enough for the shared minimum. */
const STRONG = 'a-long-enough-password';

describe('password requirements', () => {
  it('evaluates the shared password policy', () => {
    expect(checkPassword(STRONG, STRONG)).toEqual({ length: true, match: true });
  });

  it('only requires the rules requested by a form', () => {
    const results = checkPassword(STRONG);

    expect(meetsPasswordRequirements(results, ['length'])).toBe(true);
    expect(meetsPasswordRequirements(results, ['length', 'match'])).toBe(false);
  });

  // The checklist used to carry its own copy of the minimum, which is how it
  // came to promise eight characters while the schema had moved on. Pin it to
  // the shared constant at the boundary so the two cannot drift again.
  it('takes its length rule from the shared minimum', () => {
    const short = 'x'.repeat(PASSWORD_MIN_LENGTH - 1);
    const exact = 'x'.repeat(PASSWORD_MIN_LENGTH);

    expect(checkPassword(short).length).toBe(false);
    expect(checkPassword(exact).length).toBe(true);
  });

  // The checklist demanded a digit and mixed case that neither the schema nor
  // Better Auth ever checked, so it refused passwords the API would have
  // taken. Nothing but length and match is the point.
  it('asks for nothing the API does not enforce', () => {
    expect(Object.keys(checkPassword('anything')).sort()).toEqual(['length', 'match']);
    expect(checkPassword('all lowercase and no digits at all').length).toBe(true);
  });
});
