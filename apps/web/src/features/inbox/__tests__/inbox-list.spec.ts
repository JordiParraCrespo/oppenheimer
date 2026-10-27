import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { currentItem } from '../lib/inbox-current';
import { facetCounts, listedItems } from '../lib/inbox-filter';
import type { InboxVisit } from '../lib/inbox-visit';

/**
 * What the Inbox's list shows and the pane takes its item from
 * (`29-inbox.md` §5): Later sends an item to the end for this visit, an
 * answered one leaves before its source catches up, Show done lists only
 * what was marked done on this visit, and the facets count an item under
 * every project that holds it.
 */

const item = (key: string, kind: InboxItem['kind'], projectIds: string[] = []) =>
  ({ key, kind, projectIds, since: new Date(0), low: false }) as unknown as InboxItem;

const visit = (patch: Partial<InboxVisit> = {}): InboxVisit => ({
  log: [],
  later: [],
  done: [],
  answered: [],
  ...patch,
});

const ALL = { type: 'all', project: null } as const;

describe('listedItems', () => {
  const open = [item('a', 'approval'), item('b', 'pull'), item('c', 'run')];

  it('sends an item put off with Later after the rest, and drops one already answered', () => {
    const { open: listed } = listedItems(
      { open, done: [] },
      visit({ later: ['a'], answered: ['b'] }),
      ALL,
      true,
    );
    expect(listed.map((row) => row.key)).toEqual(['c', 'a']);
  });

  it('lists under Show done only what was marked done on this visit', () => {
    const done = [item('old', 'run'), item('now', 'run')];
    expect(listedItems({ open, done }, visit({ done: ['now'] }), ALL, true).done).toEqual([
      done[1],
    ]);
    expect(listedItems({ open, done }, visit({ done: ['now'] }), ALL, false).done).toEqual([]);
  });

  it('narrows to a type and a project, No project included', () => {
    const rows = [item('a', 'pull', ['p1']), item('b', 'pull'), item('c', 'run', ['p1'])];
    const pick = (filter: Parameters<typeof listedItems>[2]) =>
      listedItems({ open: rows, done: [] }, visit(), filter, true).open.map((row) => row.key);
    expect(pick({ type: 'pull', project: null })).toEqual(['a', 'b']);
    expect(pick({ type: 'all', project: 'p1' })).toEqual(['a', 'c']);
    expect(pick({ type: 'pull', project: 'none' })).toEqual(['b']);
  });
});

describe('facetCounts', () => {
  it('counts an item under each project that holds it, and one no project holds under No project', () => {
    const rows = [item('a', 'pull', ['p1', 'p2']), item('b', 'session'), item('c', 'pull', ['p1'])];
    const counts = facetCounts(rows, ALL);
    expect(Object.fromEntries(counts.projects)).toEqual({ p1: 2, p2: 1, none: 1 });
    expect(counts.types).toMatchObject({ all: 3, pull: 2, session: 1, run: 0 });
  });
});

describe('currentItem', () => {
  const rows = [item('a', 'run'), item('b', 'run')];

  it('is the item the address names while it is listed, else the first', () => {
    expect(currentItem(rows, 'b')?.key).toBe('b');
    expect(currentItem(rows, 'gone')?.key).toBe('a');
    expect(currentItem([], null)).toBeNull();
  });
});
