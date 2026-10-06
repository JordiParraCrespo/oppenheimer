import type { DragItem, SortableGroups } from '@oppenheimer/design-system-web';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBoardDrag } from '@/features/tasks/hooks/use-board-drag';

/**
 * A dropped card stays where it was dropped until the board's read catches
 * up. The move writes the read a tick after the drop; showing the old read in
 * between put the card back in its old column for a frame and then jumped it
 * to the new one, which is what made the drop feel rough.
 */

afterEach(cleanup);

const BEFORE: SortableGroups = { todo: ['a', 'b'], doing: ['c'] };
const card = (id: string): DragItem => ({ id, data: { type: 'task' } });
const column = (id: string): DragItem => ({ id, data: { group: true } });

function dropAIntoDoing(handlers: ReturnType<typeof useBoardDrag>['handlers']) {
  act(() => handlers.onDragStart(card('a')));
  act(() => handlers.onDragOver({ active: card('a'), over: card('c'), after: true }));
  act(() => handlers.onDragEnd({ active: card('a'), over: card('c'), after: true }));
}

describe('useBoardDrag', () => {
  it('keeps the dropped order while the read is still the old one, then follows the read', () => {
    const onMove = vi.fn();
    const { result, rerender } = renderHook(({ columns }) => useBoardDrag(columns, onMove), {
      initialProps: { columns: BEFORE },
    });

    dropAIntoDoing(result.current.handlers);

    expect(onMove).toHaveBeenCalledWith({ id: 'a', status: 'doing', afterTaskId: 'c' });
    expect(result.current.groups).toEqual({ todo: ['b'], doing: ['c', 'a'] });

    // The move's optimistic write lands.
    rerender({ columns: { todo: ['b'], doing: ['c', 'a'] } });
    expect(result.current.groups).toEqual({ todo: ['b'], doing: ['c', 'a'] });

    // The server refuses and the read rolls back: the card goes home, and stays there.
    rerender({ columns: BEFORE });
    expect(result.current.groups).toEqual(BEFORE);
  });

  it('puts everything back when the card is let go over nothing', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() => useBoardDrag(BEFORE, onMove));

    act(() => result.current.handlers.onDragStart(card('a')));
    act(() => result.current.handlers.onDragOver({ active: card('a'), over: column('doing') }));
    act(() => result.current.handlers.onDragEnd({ active: card('a'), over: null }));

    expect(onMove).not.toHaveBeenCalled();
    expect(result.current.groups).toEqual(BEFORE);
  });
});
