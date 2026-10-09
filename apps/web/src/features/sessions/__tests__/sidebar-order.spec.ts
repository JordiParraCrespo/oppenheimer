import type { ProjectEntity, SessionEntity } from '@oppenheimer/frontend-consumer';
import { afterEach, describe, expect, it } from 'vitest';
import {
  orderProjects,
  orderSessions,
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
