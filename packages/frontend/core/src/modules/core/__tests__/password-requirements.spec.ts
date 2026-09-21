import { PASSWORD_MIN_LENGTH } from '@oppenheimer/shared/constants';
import { describe, expect, it } from 'vitest';
import { checkPassword, meetsPasswordRequirements } from '../password-requirements';

/** Long enough for the shared minimum, and carrying both cases and a digit. */
const STRONG = 'Strong123abcd';

describe('password requirements', () => {
  it('evaluates the shared password policy', () => {
    expect(checkPassword(STRONG, STRONG)).toEqual({
      length: true,
      case: true,
      number: true,
      match: true,
    });
  });

  it('only requires the rules requested by a form', () => {
    const results = checkPassword(STRONG);

    expect(meetsPasswordRequirements(results, ['length', 'case', 'number'])).toBe(true);
    expect(meetsPasswordRequirements(results, ['length', 'case', 'number', 'match'])).toBe(false);
  });

  // The checklist used to carry its own copy of the minimum, which is how it
  // came to promise eight characters while the schema had moved on. Pin it to
  // the shared constant at the boundary so the two cannot drift again.
  it('takes its length rule from the shared minimum', () => {
    const short = 'Aa1'.padEnd(PASSWORD_MIN_LENGTH - 1, 'x');
    const exact = 'Aa1'.padEnd(PASSWORD_MIN_LENGTH, 'x');

    expect(checkPassword(short).length).toBe(false);
    expect(checkPassword(exact).length).toBe(true);
  });
});
