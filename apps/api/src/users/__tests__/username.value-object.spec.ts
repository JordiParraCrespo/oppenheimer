import { USERNAME_PATTERN } from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import { USERNAME_CHECK } from '../../migrations/1790900000000-InitialSchema';
import { Username } from '../domain/value-objects/username.value-object';

describe('Username', () => {
  it('normalises what it is given', () => {
    expect(Username.from('  Jordi-Parra ').value).toBe('jordi-parra');
  });

  it.each(['-adri', 'adri-', 'ad--ri', 'adri_parra', '', 'a'.repeat(40)])('refuses %j', (raw) => {
    expect(() => Username.from(raw)).toThrow();
  });

  it('is the rule the database checks', () => {
    // The migration quotes the pattern instead of importing it; this is what
    // keeps the two spellings one.
    expect(USERNAME_CHECK).toBe(USERNAME_PATTERN.source);
  });
});
