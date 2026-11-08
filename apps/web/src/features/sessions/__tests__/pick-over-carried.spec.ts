import { describe, expect, it } from 'vitest';
import { pickOverCarried } from '../lib/session-options';

/**
 * New session opens on the repositories of the last one. Picking another there
 * means "this one instead", so the carried repository must leave; the
 * regression is a second session that silently clones the first one's
 * repository too.
 */
describe('pickOverCarried', () => {
  const carried = { id: 'i:1', branch: 'main' };
  const picked = { id: 'i:2', branch: 'main' };

  it('replaces the carried repository with the first one picked', () => {
    expect(pickOverCarried([carried], [carried, picked])).toEqual([picked]);
  });

  it('replaces a full carried selection, whose oldest row the cap already dropped', () => {
    const full = [1, 2, 3, 4, 5].map((n) => ({ id: `i:${n}`, branch: 'main' }));
    const capped = [...full.slice(1), { id: 'i:9', branch: 'main' }];
    expect(pickOverCarried(full, capped)).toEqual([{ id: 'i:9', branch: 'main' }]);
  });

  it('lets a carried repository be unticked', () => {
    expect(pickOverCarried([carried], [])).toEqual([]);
  });

  it('lets a carried repository change branch', () => {
    const moved = { ...carried, branch: 'develop' };
    expect(pickOverCarried([carried], [moved])).toEqual([moved]);
  });
});
