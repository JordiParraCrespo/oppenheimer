import { describe, expect, it } from 'vitest';
import { assignProps } from '../entity-props';

// An entity built from an API answer that leaves a field out keeps that
// field's default, as a positional parameter with a default did; the
// regression is a default overwritten with `undefined`.
class Thing {
  readonly id!: string;
  readonly tags: string[] = [];
  readonly seq: number = 0;

  constructor(props: Pick<Thing, 'id'> & Partial<Pick<Thing, 'tags' | 'seq'>>) {
    assignProps(this, props);
  }
}

describe('assignProps', () => {
  it('sets every given field', () => {
    const thing = new Thing({ id: 't-1', tags: ['a'], seq: 3 });
    expect(thing).toMatchObject({ id: 't-1', tags: ['a'], seq: 3 });
  });

  it('keeps a default where the prop is undefined, and takes null and 0 as given', () => {
    const thing = new Thing({ id: 't-1', tags: undefined, seq: 0 });
    expect(thing.tags).toEqual([]);
    expect(thing.seq).toBe(0);
  });
});
