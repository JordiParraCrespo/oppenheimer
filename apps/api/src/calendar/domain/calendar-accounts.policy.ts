import { GOOGLE_CALENDAR_ACCOUNTS_MAX } from '@oppenheimer/shared';

/** Whether a person holding `held` accounts may connect one more (five at most, `23-…` §5). */
export function canConnectAnotherAccount(held: number): boolean {
  return held < GOOGLE_CALENDAR_ACCOUNTS_MAX;
}

/**
 * The colour a new account takes: the lowest index none of the person's other
 * accounts holds. Picked once and never reassigned, so removing an account
 * frees its colour without moving anyone else's. Null when every one is taken.
 */
export function nextColorIndex(taken: readonly number[]): number | null {
  const held = new Set(taken);
  for (let index = 0; index < GOOGLE_CALENDAR_ACCOUNTS_MAX; index += 1) {
    if (!held.has(index)) return index;
  }
  return null;
}
