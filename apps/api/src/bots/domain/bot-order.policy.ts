import type { Placement } from './bot.types';

/**
 * The order of a group's bots (or of the groups) after one of them moves:
 * `moved` taken out of `current` and put at `at`, an index clamped to the
 * list, or last. The result is what positions 0…n-1 are written from, so the
 * sidebar's order never has gaps or ties after a move.
 */
export function placeInOrder(current: readonly string[], moved: string, at: Placement): string[] {
  const others = current.filter((id) => id !== moved);
  const index = at === 'last' ? others.length : Math.max(0, Math.min(at, others.length));
  return [...others.slice(0, index), moved, ...others.slice(index)];
}
