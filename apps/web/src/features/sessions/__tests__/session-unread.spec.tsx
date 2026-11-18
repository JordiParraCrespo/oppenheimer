import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type SessionUnread,
  SessionUnreadContext,
  useSessionUnread,
  useSessionUnreadMarks,
} from '../hooks/use-session-unread';

/**
 * A session marked unread keeps its dot across a reload until the reader
 * opens it; marking the session that is open does not clear it at once, or
 * the mark would never stick on the row the reader is looking at.
 */

afterEach(() => window.localStorage.clear());

type Row = ReturnType<typeof useSessionUnread>;

function Row({ active, onRow }: { active: boolean; onRow: (row: Row) => void }) {
  onRow(useSessionUnread('s1', active));
  return null;
}

function Sidebar({
  active,
  seen,
}: {
  active: boolean;
  seen: { marks?: SessionUnread; row?: Row };
}) {
  const marks = useSessionUnreadMarks();
  seen.marks = marks;
  return (
    <SessionUnreadContext value={marks}>
      <Row
        active={active}
        onRow={(row) => {
          seen.row = row;
        }}
      />
    </SessionUnreadContext>
  );
}

function renderSidebar(active: boolean) {
  const seen: { marks?: SessionUnread; row?: Row } = {};
  const view = render(<Sidebar active={active} seen={seen} />);
  return {
    seen,
    open: () => view.rerender(<Sidebar active seen={seen} />),
    unmount: view.unmount,
  };
}

describe('useSessionUnread', () => {
  it('keeps a mark across a reload and takes it off when the session is opened', () => {
    const first = renderSidebar(false);
    act(() => first.seen.row?.setUnread(true));
    first.unmount();

    const second = renderSidebar(false);
    expect(second.seen.row?.unread).toBe(true);
    act(() => second.open());
    expect(second.seen.marks?.marks).toEqual([]);
  });

  it('keeps the mark on the open session it was set on', () => {
    const { seen, open } = renderSidebar(true);
    act(() => seen.row?.setUnread(true));
    act(() => open());
    expect(seen.marks?.marks).toEqual(['s1']);
    expect(seen.row?.unread).toBe(true);
  });
});
