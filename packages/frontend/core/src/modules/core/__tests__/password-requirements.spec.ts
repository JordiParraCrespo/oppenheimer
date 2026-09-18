import { describe, expect, it } from 'vitest';
import { checkPassword, meetsPasswordRequirements } from '../password-requirements';

describe('password requirements', () => {
  it('evaluates the shared password policy', () => {
    expect(checkPassword('Strong123', 'Strong123')).toEqual({
      length: true,
      case: true,
      number: true,
      match: true,
    });
  });

  it('only requires the rules requested by a form', () => {
    const results = checkPassword('Strong123');

    expect(meetsPasswordRequirements(results, ['length', 'case', 'number'])).toBe(true);
    expect(meetsPasswordRequirements(results, ['length', 'case', 'number', 'match'])).toBe(false);
  });
});
