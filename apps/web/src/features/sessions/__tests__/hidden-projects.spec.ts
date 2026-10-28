import type { ProjectEntity, SessionEntity } from '@oppenheimer/frontend-consumer';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useHiddenProjects } from '../hooks/use-hidden-projects';
import { HIDDEN_PROJECTS_KEY, listedProjects, withHidden } from '../lib/hidden-projects';
import { storedList } from '../lib/stored-list';

/**
 * A project hidden from the sidebar stays hidden on the next visit, and one
 * shown again, or shown with the rest, comes back.
 */

afterEach(() => window.localStorage.clear());

describe('useHiddenProjects', () => {
  it('keeps a hidden project across a reload and forgets it once shown', () => {
    const first = renderHook(() => useHiddenProjects());
    act(() => first.result.current.setShown('p1', false));
    act(() => first.result.current.setShown('p2', false));
    first.unmount();

    const second = renderHook(() => useHiddenProjects());
    expect(second.result.current.hidden).toEqual(['p1', 'p2']);
    act(() => second.result.current.setShown('p1', true));
    expect(storedList(HIDDEN_PROJECTS_KEY)).toEqual(['p2']);
    act(() => second.result.current.showAll());
    expect(storedList(HIDDEN_PROJECTS_KEY)).toEqual([]);
  });
});

describe('withHidden', () => {
  it('hides a project once however often it is hidden', () => {
    expect(withHidden(withHidden(['a'], 'a', false), 'a', false)).toEqual(['a']);
  });
});

describe('listedProjects', () => {
  const project = (id: string) => ({ id }) as ProjectEntity;
  const session = (id: string, projectId: string) => ({ id, projectId }) as SessionEntity;

  it('leaves out a hidden project and its sessions, unless the project filter picks it', () => {
    const projects = [project('a'), project('b')];
    const sessions = [session('s1', 'a'), session('s2', 'b')];

    const hiding = listedProjects(projects, sessions, ['b', 'gone'], null);
    expect(hiding.sessions.map(({ id }) => id)).toEqual(['s1']);
    expect([hiding.listed('a'), hiding.listed('b')]).toEqual([true, false]);
    expect(hiding.hiddenCount).toBe(1);

    const picked = listedProjects(projects, sessions, ['b'], 'b');
    expect(picked.sessions.map(({ id }) => id)).toEqual(['s1', 's2']);
    expect(picked.listed('b')).toBe(true);
  });
});
