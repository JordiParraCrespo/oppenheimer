import { sessionEntity } from '@oppenheimer/frontend-consumer/testing';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GroupSessionsMenu } from '../sections/group-sessions-menu';

/**
 * A sidebar group's menu acts on every session the group lists: Hide all
 * hides the ones still shown and leaves the hidden ones alone, Show all
 * appears only once every one is hidden, and Delete all hands the whole group
 * to the sidebar's dialog. A regression that acted on one row, or wrote a
 * session already in the state asked for, breaks it.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

// The batch as the API would answer it: every id changed, or the ones `refuse` names refused.
let refuse: string[] = [];
const mutateAsync = vi.fn(async ({ ids, hidden }: { ids: string[]; hidden: boolean }) => ({
  changed: ids
    .filter((id) => !refuse.includes(id))
    .map((id) => sessionEntity({ id, name: id, hidden })),
  failed: ids.filter((id) => refuse.includes(id)),
  reason: refuse.length > 0 ? new Error('refused') : null,
}));
vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useSetSessionsHidden: () => ({ mutateAsync, isPending: false }),
}));
const notifySuccess = vi.fn();
vi.mock('@oppenheimer/frontend-web', () => ({
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
}));

afterEach(() => {
  cleanup();
  mutateAsync.mockClear();
  refuse = [];
  notifySuccess.mockClear();
});

function renderMenu(rows: { id: string; hidden: boolean }[]) {
  const sessions = rows.map((row) => sessionEntity(row));
  const onDeleteAll = vi.fn();
  const onWrite = vi.fn();
  render(
    <GroupSessionsMenu
      label="Superseo"
      sessions={sessions}
      open
      onOpenChange={() => {}}
      onDeleteAll={onDeleteAll}
      onWrite={onWrite}
    />,
  );
  return { sessions, onDeleteAll, onWrite };
}

describe('GroupSessionsMenu', () => {
  it('hides every shown session in the group, and only those', async () => {
    const { onWrite } = renderMenu([
      { id: 'a', hidden: false },
      { id: 'b', hidden: true },
      { id: 'c', hidden: false },
    ]);

    fireEvent.click(screen.getByText('sessions.group.hideAll'));

    await waitFor(() => expect(onWrite).toHaveBeenCalledWith(null));
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({ ids: ['a', 'c'], hidden: true });
    expect(notifySuccess).toHaveBeenCalledWith('sessionsHidden', { n: '2' });
  });

  it('offers Show all once every session is hidden', async () => {
    const { onWrite } = renderMenu([
      { id: 'a', hidden: true },
      { id: 'b', hidden: true },
    ]);

    expect(screen.queryByText('sessions.group.hideAll')).toBeNull();
    fireEvent.click(screen.getByText('sessions.group.showAll'));

    await waitFor(() => expect(onWrite).toHaveBeenCalledWith(null));
    expect(mutateAsync).toHaveBeenCalledWith({ ids: ['a', 'b'], hidden: false });
  });

  it('shows the first refusal and toasts only what landed', async () => {
    refuse = ['a'];
    const { onWrite } = renderMenu([
      { id: 'a', hidden: false },
      { id: 'b', hidden: false },
    ]);

    fireEvent.click(screen.getByText('sessions.group.hideAll'));

    await waitFor(() => expect(onWrite).toHaveBeenCalled());
    expect(onWrite).toHaveBeenCalledWith(expect.objectContaining({ message: 'refused' }));
    expect(notifySuccess).toHaveBeenCalledWith('sessionHidden', { name: 'b' });
  });

  it('hands the whole group to the delete dialog', () => {
    const { sessions, onDeleteAll } = renderMenu([
      { id: 'a', hidden: false },
      { id: 'b', hidden: true },
    ]);

    fireEvent.click(screen.getByText('sessions.group.deleteAll'));

    expect(onDeleteAll).toHaveBeenCalledWith(sessions);
  });
});
