import { describe, expect, it } from 'vitest';
import { leadThenFollow, matchingCommands } from './command-menu';

/**
 * Which commands a `/` menu offers for what is typed. What breaks this: hiding
 * a command whose name only contains what was typed, or a menu that grows
 * past the screen.
 */
const named = (name: string) => ({ name });

describe('matchingCommands', () => {
  it('lists names that start with what is typed first, then those that contain it', () => {
    const names = matchingCommands(
      [named('pr-review'), named('review'), named('triage')],
      'rev',
    ).map((found) => found.name);
    expect(names).toEqual(['review', 'pr-review']);
  });

  it('lists at most eight', () => {
    const many = Array.from({ length: 12 }, (_, i) => named(`s${i}`));
    expect(matchingCommands(many, '')).toHaveLength(8);
  });
});

describe('leadThenFollow', () => {
  it('fills the rows the leading list leaves with the following one', () => {
    const lead = Array.from({ length: 6 }, (_, i) => named(`a${i}`));
    const follow = Array.from({ length: 6 }, (_, i) => named(`b${i}`));
    const [first, second] = leadThenFollow(lead, follow, '');
    expect(first).toHaveLength(6);
    expect(second.map((found) => found.name)).toEqual(['b0', 'b1']);
  });
});
