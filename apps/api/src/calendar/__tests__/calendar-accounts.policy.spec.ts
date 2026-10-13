import { describe, expect, it } from 'vitest';
import { canConnectAnotherAccount, nextColorIndex } from '../domain/calendar-accounts.policy';

/**
 * A person's accounts and their colours. What breaks if this regresses: a
 * sixth account is let in, or removing an account moves another's colour
 * (or gives a new one a colour already on the month).
 */
describe('calendar accounts policy', () => {
  it('lets a person connect up to five accounts', () => {
    expect(canConnectAnotherAccount(4)).toBe(true);
    expect(canConnectAnotherAccount(5)).toBe(false);
  });

  it('gives a new account the lowest colour no other holds, the one a removed account freed', () => {
    expect(nextColorIndex([])).toBe(0);
    expect(nextColorIndex([0, 1, 2])).toBe(3);
    expect(nextColorIndex([0, 2, 3])).toBe(1);
    expect(nextColorIndex([0, 1, 2, 3, 4])).toBeNull();
  });
});
