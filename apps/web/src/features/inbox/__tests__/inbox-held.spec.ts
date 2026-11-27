// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { heldCurrent } from '../lib/inbox-held';

/**
 * A card whose Reply here is open holds the deck. The regression: the reader
 * answered an unattended session in place, the session went back to work and
 * left the list, the deck went on to the next card under the reader's hands,
 * and the keys still being typed drove the deck: a digit pressed the next
 * card's Allow.
 */

const card = (key: string) => ({ key });
const held = card('unattended:s1:2026-11-27T10:00:00.000Z');
const next = card('session:s2:2026-11-27T10:05:00.000Z');

describe('heldCurrent', () => {
  it('keeps the held card on the deck once its session leaves the list', () => {
    expect(heldCurrent([next], held.key, next, held)).toBe(held);
    expect(heldCurrent([next], null, next, held)).toBe(held);
  });

  it('keeps it under a new key while its session is still listed, as the list says', () => {
    const renamed = card('unattended:s1:2026-11-27T10:02:00.000Z');
    expect(heldCurrent([renamed, next], held.key, renamed, held)).toBe(renamed);
  });

  // The regression: with no item named, the deck shows the first item, and a
  // newer item sorted above the held card took its place and closed its
  // session mid-typing.
  it('keeps the held card when a newer item sorts above it and the address names none', () => {
    const newer = card('session:s3:2026-11-27T10:09:00.000Z');
    expect(heldCurrent([newer, held, next], null, newer, held)).toBe(held);
  });

  it('lets go once the reader moves on to another card', () => {
    expect(heldCurrent([next], next.key, next, held)).toBe(next);
  });

  it('changes nothing with no card held', () => {
    expect(heldCurrent([next], held.key, next, null)).toBe(next);
  });
});
