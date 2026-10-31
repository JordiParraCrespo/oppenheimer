import { describe, expect, it } from 'vitest';
import { cutRuns, type ExploreTarget, exploredParts } from '../chat-runs';

/**
 * The fold both chats draw their calls with. What breaks this: a run carried
 * past a call of the other sort, so a change hides inside an Explored line;
 * the same thing looked at twice named twice; verbs reordered.
 */

describe('cutRuns', () => {
  it('cuts wherever the calls turn from looking to acting and back, keeping their order', () => {
    const runs = cutRuns(['read', 'grep', 'edit', 'test', 'read'], (call) =>
      ['read', 'grep'].includes(call),
    );
    expect(runs).toEqual([
      { explored: true, items: ['read', 'grep'] },
      { explored: false, items: ['edit', 'test'] },
      { explored: true, items: ['read'] },
    ]);
  });

  it('has no run for no calls', () => {
    expect(cutRuns([], () => true)).toEqual([]);
  });
});

describe('exploredParts', () => {
  const targets: Record<string, ExploreTarget[] | null> = {
    a: [{ verb: 'read', key: 'src/a.ts', label: 'a.ts' }],
    b: [{ verb: 'search', key: 'cancel', label: 'cancel' }],
    c: [{ verb: 'read', key: 'src/a.ts', label: 'a.ts' }],
    d: [{ verb: 'read', key: 'lib/a.ts', label: 'a.ts' }],
    e: null,
    f: [{ verb: 'list', key: '', label: '' }],
  };

  it('names each thing once by its key, each verb in the order it first came', () => {
    expect(exploredParts(['a', 'b', 'c', 'd', 'e'], (id) => targets[id] ?? null)).toEqual([
      { verb: 'read', targets: ['a.ts', 'a.ts'] },
      { verb: 'search', targets: ['cancel'] },
    ]);
  });

  it('keeps a verb whose call named nothing, with no target', () => {
    expect(exploredParts(['f'], (id) => targets[id] ?? null)).toEqual([
      { verb: 'list', targets: [] },
    ]);
  });
});
