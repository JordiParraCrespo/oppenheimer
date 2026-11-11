import type { ProjectEntity, SessionEntity } from '@oppenheimer/frontend-consumer';
import { afterEach, describe, expect, it } from 'vitest';
import {
  mergeOrder,
  orderProjects,
  orderSessions,
  placeDrop,
  rememberSidebarOrder,
  SIDEBAR_ORDER_KEY,
  storedSidebarOrder,
} from '../lib/sidebar-order';

/**
 * The sidebar order a reader dragged comes back on the next visit, and never
 * loses a project or a session: one made since the last drag lands on top,
 * one gone since is skipped, and anything unreadable in storage is the
 * API's order with Unassigned first.
 */

const project = (id: string) => ({ id, isUnassigned: id === 'unassigned' }) as ProjectEntity;
const session = (id: string) => ({ id }) as SessionEntity;
const idsOf = (rows: { id: string }[]) => rows.map((row) => row.id);

afterEach(() => window.localStorage.clear());

describe('storedSidebarOrder', () => {
  it('restores the order a drop remembered', () => {
    rememberSidebarOrder({ projects: ['b', 'a'], sessions: ['s2', 's1'] });
    expect(storedSidebarOrder()).toEqual({ projects: ['b', 'a'], sessions: ['s2', 's1'] });
  });

  it.each(['{not json', '"b"', '{"projects":"b","sessions":[1,"s1","s1"]}'])(
    'reads %s as what it can make of it',
    (raw) => {
      window.localStorage.setItem(SIDEBAR_ORDER_KEY, raw);
      const order = storedSidebarOrder();
      expect(order.projects).toEqual([]);
      expect(order.sessions).toEqual(raw.includes('s1') ? ['s1'] : []);
    },
  );
});

describe('orderProjects', () => {
  it('puts Unassigned first when nothing was dragged', () => {
    expect(idsOf(orderProjects([project('newer'), project('unassigned')], []))).toEqual([
      'unassigned',
      'newer',
    ]);
  });

  it('keeps the dragged order, with a project made since on top', () => {
    const projects = [project('fresh'), project('a'), project('unassigned'), project('b')];
    expect(idsOf(orderProjects(projects, ['b', 'gone', 'unassigned', 'a']))).toEqual([
      'fresh',
      'b',
      'unassigned',
      'a',
    ]);
  });
});

describe('orderSessions', () => {
  it('keeps the dragged order, with sessions started since on top in the order they came', () => {
    const sessions = [session('new2'), session('new1'), session('s1'), session('s2')];
    expect(idsOf(orderSessions(sessions, ['s2', 's1']))).toEqual(['new2', 'new1', 's2', 's1']);
  });
});

describe('mergeOrder', () => {
  it('keeps a session the drop did not see (a pinned one) after the one it followed', () => {
    expect(mergeOrder(['s3', 's1', 's4'], ['s1', 'pinned', 's3', 's4'])).toEqual([
      's3',
      's1',
      'pinned',
      's4',
    ]);
  });

  it('keeps one that led the stored order at the front', () => {
    expect(mergeOrder(['s2', 's1'], ['pinned', 's1', 's2'])).toEqual(['pinned', 's2', 's1']);
  });

  it('keeps a hidden project in its place when the shown ones are dragged', () => {
    expect(mergeOrder(['p3', 'p1'], ['p1', 'hidden', 'p3'])).toEqual(['p3', 'p1', 'hidden']);
  });
});

describe('placeDrop', () => {
  const row = (id: string, projectId: string) => ({ id, projectId }) as SessionEntity;

  it("keeps a hidden row among its own project's rows when another project is reordered", () => {
    // Newest first, the projects interleave: a1, b1, hidden (a), a2, b2.
    const whole = [
      row('a1', 'a'),
      row('b1', 'b'),
      row('hidden', 'a'),
      row('a2', 'a'),
      row('b2', 'b'),
    ];
    const order = placeDrop({
      dropped: { a: ['a1', 'a2'], b: ['b2', 'b1'] },
      projectIds: ['a', 'b'],
      whole,
      stored: [],
    });
    expect(order).toEqual(['a1', 'hidden', 'a2', 'b2', 'b1']);
  });

  it('anchors nothing at the old place of a session moved in from another project', () => {
    // a2 sat just above b's hidden row in the whole list, and is dropped after b1.
    const whole = [
      row('a1', 'a'),
      row('b1', 'b'),
      row('a2', 'a'),
      row('hidden', 'b'),
      row('b2', 'b'),
    ];
    const order = placeDrop({
      dropped: { a: ['a1'], b: ['b1', 'a2', 'b2'] },
      projectIds: ['a', 'b'],
      whole,
      stored: [],
      moved: 'a2',
    });
    expect(order).toEqual(['a1', 'b1', 'hidden', 'a2', 'b2']);
  });

  it('keeps the place of a stored session the list does not draw', () => {
    const order = placeDrop({
      dropped: { a: ['a2', 'a1'] },
      projectIds: ['a'],
      whole: [row('a1', 'a'), row('a2', 'a')],
      stored: ['a1', 'gone', 'a2'],
    });
    expect(order).toEqual(['a2', 'a1', 'gone']);
  });
});
