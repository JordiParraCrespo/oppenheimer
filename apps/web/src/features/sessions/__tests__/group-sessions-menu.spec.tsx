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

const mutateAsync = vi.fn(async () => {});
vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useSetSessionHidden: () => ({ mutateAsync, isPending: false }),
}));
const notifySuccess = vi.fn();
vi.mock('@oppenheimer/frontend-web', () => ({
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
}));

afterEach(() => {
  cleanup();
  mutateAsync.mockClear();
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
    expect(mutateAsync).toHaveBeenCalledTimes(2);
    expect(mutateAsync).toHaveBeenCalledWith({ id: 'a', hidden: true });
    expect(mutateAsync).toHaveBeenCalledWith({ id: 'c', hidden: true });
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
    expect(mutateAsync).toHaveBeenCalledWith({ id: 'a', hidden: false });
    expect(mutateAsync).toHaveBeenCalledWith({ id: 'b', hidden: false });
  });

  it('shows the first refusal and toasts only what landed', async () => {
    mutateAsync.mockImplementationOnce(async () => {
      throw new Error('refused');
    });
    const { onWrite } = renderMenu([
      { id: 'a', hidden: false },
      { id: 'b', hidden: false },
    ]);

    fireEvent.click(screen.getByText('sessions.group.hideAll'));

    await waitFor(() => expect(onWrite).toHaveBeenCalled());
    expect(onWrite).toHaveBeenCalledWith(expect.objectContaining({ message: 'refused' }));
    expect(notifySuccess).toHaveBeenCalledWith('sessionHidden', expect.anything());
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
