// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  lifetimeCovering,
  namedPeople,
  SHARE_DEFAULTS,
  shareInput,
  withAccess,
} from '../lib/share-session';

/**
 * What Share sends: a link only ever watches, whatever was last picked for
 * the permission; write never outlasts a day; and a live share changed in
 * one setting keeps its end, rather than starting a new clock.
 */

const HOUR = 60 * 60 * 1000;

describe('what Share sends', () => {
  it('sends a link as watching, without people', () => {
    expect(
      shareInput({ audience: 'link', access: 'write', lifetime: '7d' }, ['ada@example.com']),
    ).toEqual({ audience: 'link', access: 'read', lifetime: '7d' });
  });

  it('never sends write access past a day', () => {
    expect(
      shareInput({ audience: 'people', access: 'write', lifetime: 'never' }, ['ada@example.com']),
    ).toEqual({ audience: 'people', access: 'write', people: ['ada@example.com'], lifetime: '1h' });
  });

  it('shares with an address still typed in the field', () => {
    expect(namedPeople({ people: ['ada@example.com'], typed: ' Bob@Example.com ' })).toEqual([
      'ada@example.com',
      'bob@example.com',
    ]);
    // Half an address is not anyone.
    expect(namedPeople({ people: ['ada@example.com'], typed: 'bob@' })).toEqual([
      'ada@example.com',
    ]);
  });

  it('starts write access on its shortest lifetime, and keeps a lifetime when watching', () => {
    expect(withAccess(SHARE_DEFAULTS, 'write')).toEqual({
      ...SHARE_DEFAULTS,
      access: 'write',
      lifetime: '1h',
    });
    const writing = { ...SHARE_DEFAULTS, access: 'write' as const, lifetime: '8h' as const };
    expect(withAccess(writing, 'read')).toEqual({ ...writing, access: 'read' });
  });
});

describe('a live share changed in one setting', () => {
  it('keeps what it had left', () => {
    expect(lifetimeCovering('read', 5 * HOUR)).toBe('8h');
    expect(lifetimeCovering('read', 3 * 24 * HOUR)).toBe('7d');
    expect(lifetimeCovering('read', null)).toBe('never');
  });

  it('ends within a day once it can write', () => {
    expect(lifetimeCovering('write', 3 * 24 * HOUR)).toBe('24h');
    expect(lifetimeCovering('write', null)).toBe('24h');
  });
});
