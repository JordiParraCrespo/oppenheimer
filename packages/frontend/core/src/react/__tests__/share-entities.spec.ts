import { describe, expect, it } from 'vitest';
import { shareEntities } from '../share-entities';

class Checkout {
  constructor(
    public readonly id: string,
    public readonly branch: string,
  ) {}
}

class Row {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly createdAt: Date,
    public readonly checkouts: Checkout[],
  ) {}

  get label(): string {
    return `${this.name} (${this.checkouts.length})`;
  }
}

const row = (id: string, name = id, branch = 'main') =>
  new Row(id, name, new Date('2026-09-26T10:00:00Z'), [new Checkout(`${id}-c`, branch)]);

describe('shareEntities', () => {
  it('keeps the previous list when a refetch returns equal entities', () => {
    const previous = [row('a'), row('b')];
    expect(shareEntities(previous, [row('a'), row('b')])).toBe(previous);
  });

  it('keeps every unchanged row when one row changes', () => {
    const previous = [row('a'), row('b'), row('c')];
    const next = [row('a'), row('b', 'renamed'), row('c')];
    const shared = shareEntities(previous, next);

    expect(shared).not.toBe(previous);
    expect(shared[0]).toBe(previous[0]);
    expect(shared[1]).toBe(next[1]);
    expect(shared[2]).toBe(previous[2]);
  });

  it('sees a change nested in an entity', () => {
    const previous = [row('a')];
    const shared = shareEntities(previous, [row('a', 'a', 'develop')]);
    expect(shared[0]?.checkouts[0]?.branch).toBe('develop');
    expect(shared).not.toBe(previous);
  });

  it('compares dates by time', () => {
    const previous = row('a');
    const next = new Row('a', 'a', new Date('2026-09-26T10:00:00Z'), previous.checkouts);
    expect(shareEntities(previous, next)).toBe(previous);

    const later = new Row('a', 'a', new Date('2026-09-26T10:00:01Z'), previous.checkouts);
    expect(shareEntities(previous, later)).toBe(later);
  });

  it('keeps getters working on what it returns', () => {
    const previous = [row('a')];
    expect(shareEntities(previous, [row('a')])[0]?.label).toBe('a (1)');
  });

  it('never calls two objects of different classes equal', () => {
    class Other {
      constructor(public readonly id: string) {}
    }
    const previous = new Other('a');
    const next = { id: 'a' };
    expect(shareEntities(previous, next)).toBe(next);
  });

  /** A Map's contents are not own keys, so an own-key walk would call any two equal. */
  it('takes collections it cannot see into as changed', () => {
    const previous = new Map([['a', 1]]);
    const next = new Map([['a', 2]]);
    expect(shareEntities(previous, next)).toBe(next);
  });

  it('shares plain objects the way the default does', () => {
    const previous = { a: { b: 1 }, c: [1, 2] };
    const next = { a: { b: 1 }, c: [1, 2] };
    expect(shareEntities(previous, next)).toBe(previous);
  });

  it('takes a first read as it is', () => {
    const next = [row('a')];
    expect(shareEntities(undefined, next)).toBe(next);
  });
});
