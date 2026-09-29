import { describe, expect, it } from 'vitest';
import { Username } from '../domain/value-objects/username.value-object';

describe('Username', () => {
  it('normalises what it is given', () => {
    expect(Username.from('  Jordi-Parra ').value).toBe('jordi-parra');
  });

  it.each(['-adri', 'adri-', 'ad--ri', 'adri_parra', '', 'a'.repeat(40)])('refuses %j', (raw) => {
    expect(() => Username.from(raw)).toThrow();
  });
});
