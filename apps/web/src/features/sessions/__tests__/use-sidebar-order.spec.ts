import { type DragItem, sortableProjectId } from '@oppenheimer/design-system-web';
import type { ProjectEntity, SessionEntity } from '@oppenheimer/frontend-consumer';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSidebarOrder } from '../hooks/use-sidebar-order';
import { storedSidebarOrder } from '../lib/sidebar-order';

/**
 * What a drop keeps: a reorder inside a project is remembered at once, a
 * drop in another project moves the session and is remembered only once
 * the move lands, and a move that fails leaves the stored order as it was.
 */

type MoveCallbacks = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onSettled?: () => void;
};
const mutate = vi.hoisted(() =>
  vi.fn<(variables: { id: string; projectId: string }, callbacks: MoveCallbacks) => void>(),
);

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useMoveSession: () => ({ mutate, isPending: false, variables: undefined }),
}));

const project = (id: string) => ({ id, isUnassigned: false }) as ProjectEntity;
const session = (id: string, projectId: string): SessionEntity =>
  ({ id, projectId, inProject: (to: string) => session(id, to) }) as unknown as SessionEntity;

const PROJECTS = [project('a'), project('b')];
const SESSIONS = [session('s1', 'a'), session('s2', 'a'), session('s3', 'b')];
const item = (id: string, data: DragItem['data'] = { type: 'session' }): DragItem => ({ id, data });
const group = (id: string) => item(id, { group: true });

function setup() {
  const onWrite = vi.fn();
  const hook = renderHook(() =>
    useSidebarOrder({
      projects: PROJECTS,
      sessions: SESSIONS,
      custom: true,
      onReorder: () => {},
      onWrite,
    }),
  );
  const drag = (id: string, over: DragItem) =>
    act(() => {
      const { handlers } = hook.result.current;
      handlers.onDragStart(item(id));
      handlers.onDragOver({ active: item(id), over });
      handlers.onDragEnd({ active: item(id), over });
    });
  const drawn = () =>
    hook.result.current.groups.map((g) => [g.project?.id, g.sessions.map((s) => s.id)]);
  return { drag, drawn, onWrite };
}

beforeEach(() => mutate.mockReset());
afterEach(() => window.localStorage.clear());

describe('useSidebarOrder', () => {
  it('remembers a reorder inside a project at once, and moves nothing', () => {
    const { drag, drawn } = setup();
    drag('s2', item('s1'));
    expect(drawn()).toEqual([
      ['a', ['s2', 's1']],
      ['b', ['s3']],
    ]);
    expect(storedSidebarOrder().sessions).toEqual(['s2', 's1', 's3']);
    expect(mutate).not.toHaveBeenCalled();
  });

  it('remembers a drop in another project only once the move lands', () => {
    const { drag, drawn } = setup();
    drag('s1', group('b'));
    expect(mutate).toHaveBeenCalledWith({ id: 's1', projectId: 'b' }, expect.anything());
    expect(storedSidebarOrder().sessions).toEqual([]);

    act(() => {
      const callbacks = mutate.mock.calls[0]?.[1];
      callbacks?.onSuccess?.();
      callbacks?.onSettled?.();
    });
    expect(storedSidebarOrder().sessions).toEqual(['s2', 's3', 's1']);
    // The list has not caught up in this test, so the row is where the API says.
    expect(drawn()[0]).toEqual(['a', ['s2', 's1']]);
  });

  it('leaves the stored order alone when the move fails', () => {
    const { drag, drawn, onWrite } = setup();
    drag('s1', group('b'));
    const failure = new Error('nope');
    act(() => {
      const callbacks = mutate.mock.calls[0]?.[1];
      callbacks?.onError?.(failure);
      callbacks?.onSettled?.();
    });
    expect(onWrite).toHaveBeenCalledWith(failure);
    expect(storedSidebarOrder().sessions).toEqual([]);
    expect(drawn()).toEqual([
      ['a', ['s1', 's2']],
      ['b', ['s3']],
    ]);
  });

  it('remembers the projects a drop reorders', () => {
    const { drag, drawn } = setup();
    drag(sortableProjectId('b'), item(sortableProjectId('a'), { type: 'project' }));
    expect(drawn().map(([id]) => id)).toEqual(['b', 'a']);
    expect(storedSidebarOrder().projects).toEqual(['b', 'a']);
  });
});
