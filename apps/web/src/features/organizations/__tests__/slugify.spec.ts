import { describe, expect, it } from 'vitest';
import { slugify } from '../lib/slugify';

/**
 * The preview under the name field. It must produce what
 * `createOrganizationSchema` accepts — lowercase letters, digits and single
 * hyphens, no hyphen at either end — or the reader is shown an address the API
 * would refuse.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe('slugify', () => {
  it('lowercases and joins words with a single hyphen', () => {
    expect(slugify('Acme Labs')).toBe('acme-labs');
    expect(slugify('  Acme --  Labs & Co. ')).toBe('acme-labs-co');
  });

  it('folds accents rather than dropping the letter', () => {
    expect(slugify('Café Müller')).toBe('cafe-muller');
    expect(slugify('Ñandú')).toBe('nandu');
  });

  it('keeps digits', () => {
    expect(slugify('Team 42')).toBe('team-42');
  });

  it('never starts or ends with a hyphen', () => {
    expect(slugify('--hello--')).toBe('hello');
    expect(slugify('!hello?')).toBe('hello');
  });

  it('returns nothing for a name with nothing to keep', () => {
    expect(slugify('')).toBe('');
    expect(slugify('日本語 !!!')).toBe('');
  });

  it('caps the slug at 48 characters', () => {
    expect(slugify('a'.repeat(60))).toHaveLength(48);
  });

  it('produces only what the slug pattern accepts', () => {
    for (const name of ['Acme Labs', 'Café Müller', 'Team 42', 'x_y.z', 'A  B  C']) {
      expect(slugify(name)).toMatch(SLUG);
    }
  });
});
