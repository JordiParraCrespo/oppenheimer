import { describe, expect, it } from 'vitest';
import { personName } from './person-name';

/**
 * This exists because the query cache is persisted to localStorage and comes
 * back as plain JSON: `UserEntity.fullName` is a getter, so a rehydrated entry
 * has none and every owner silently rendered as "unassigned". The fields it
 * reads are the ones that survive that round-trip.
 */

describe('personName', () => {
  it('joins the two name fields', () => {
    expect(
      personName({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
      }),
    ).toBe('Ada Lovelace');
  });

  it('falls back to the email when both names are empty', () => {
    // A row is never blank. An email is a worse label than a name and a much
    // better one than nothing.
    expect(personName({ firstName: '', lastName: '', email: 'ada@example.com' })).toBe(
      'ada@example.com',
    );
  });

  it('uses whichever single name is present, without a stray space', () => {
    expect(personName({ firstName: 'Ada', lastName: '', email: 'a@b.com' })).toBe('Ada');
    expect(personName({ firstName: '', lastName: 'Lovelace', email: 'a@b.com' })).toBe('Lovelace');
  });

  it('survives a rehydrated record whose name fields are missing entirely', () => {
    // The reason the `?? ''` guards are there: JSON from an older cache entry
    // can be missing keys the current type says are required, and `undefined
    // undefined` is what renders without them.
    const rehydrated = { email: 'ada@example.com' } as {
      firstName: string;
      lastName: string;
      email: string;
    };

    expect(personName(rehydrated)).toBe('ada@example.com');
  });

  it('treats a whitespace-only name as empty', () => {
    expect(personName({ firstName: '  ', lastName: ' ', email: 'a@b.com' })).toBe('a@b.com');
  });

  it('does not trim the interior of a name', () => {
    expect(personName({ firstName: 'Ada', lastName: 'van Buren', email: 'a@b.com' })).toBe(
      'Ada van Buren',
    );
  });
});
