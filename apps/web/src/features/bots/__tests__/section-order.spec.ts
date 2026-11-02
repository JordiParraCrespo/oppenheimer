import { BotEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { placementInSection } from '../lib/section-order';

/**
 * Where a drop under a section's Bots heading puts the bot in the Employees
 * order, the one every list of bots draws: between the same two bots it was
 * dropped between, staying in its own group whenever a neighbour is in it.
 * The hook that saves it is `use-section-bot-order.spec.tsx`.
 */

function bot(id: string, groupId: string | null, position: number): BotEntity {
  const at = new Date('2026-10-29T09:00:00Z');
  return new BotEntity(
    id,
    id,
    '',
    'mint',
    groupId,
    position,
    null,
    'anthropic',
    null,
    null,
    'auto',
    true,
    at,
    at,
    at,
    null,
    ['pulls'],
  );
}

// Employees: Ops [a, b, c], Design [d, e], Ungrouped [f].
const ALL = [
  bot('a', 'ops', 0),
  bot('b', 'ops', 1),
  bot('c', 'ops', 2),
  bot('d', 'design', 0),
  bot('e', 'design', 1),
  bot('f', null, 0),
];

describe('placementInSection', () => {
  it('puts a bot after the one now above it in its own group, counting the bots the section hides', () => {
    // The section lists a, c, b; dropped c above b means after a in Ops.
    expect(placementInSection(ALL, ['a', 'c'], 'c')).toEqual({ groupId: 'ops', position: 1 });
    expect(placementInSection(ALL, ['c', 'a'], 'c')).toEqual({ groupId: 'ops', position: 0 });
    expect(placementInSection(ALL, ['b', 'a'], 'a')).toEqual({ groupId: 'ops', position: 1 });
  });

  it('keeps its group through the neighbour below when the one above is in another', () => {
    // Section a, d, e: e dropped between a and d stays in Design, before d.
    expect(placementInSection(ALL, ['a', 'e', 'd'], 'e')).toEqual({
      groupId: 'design',
      position: 0,
    });
  });

  it('joins the group above when neither neighbour is in its own', () => {
    expect(placementInSection(ALL, ['a', 'f', 'd'], 'f')).toEqual({ groupId: 'ops', position: 1 });
  });

  it('joins the group below when dropped first and its neighbour is in another', () => {
    expect(placementInSection(ALL, ['f', 'd', 'a'], 'f')).toEqual({
      groupId: 'design',
      position: 0,
    });
  });

  it('places nothing for a bot alone in its section, or one it does not know', () => {
    expect(placementInSection(ALL, ['a'], 'a')).toBeNull();
    expect(placementInSection(ALL, ['a', 'x'], 'x')).toBeNull();
  });
});
