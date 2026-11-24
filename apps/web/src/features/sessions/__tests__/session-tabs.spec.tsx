import { sessionEntity } from '@oppenheimer/frontend-consumer/testing';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionTabs } from '../sections/session-tabs';

/**
 * The tabs over Sessions. Closing the tab on screen goes to its neighbour,
 * and closing the last goes to New session; a session deleted since its tab
 * was opened is left off once the list answers without it, while the page
 * on screen keeps its tab, drawn from the session itself, whatever the list
 * holds. The sessions and bots lists
 * are the product package's, mocked here.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const lists = vi.hoisted(() => ({
  sessions: [] as { id: string }[],
  bots: [] as { id: string }[],
  detail: null as unknown,
}));
const navigate = vi.hoisted(() => vi.fn());

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useSessions: ({ select }: { select: (list: { id: string }[]) => unknown }) => ({
    data: select(lists.sessions),
  }),
  // The session on screen, as the page reads it: from the list's copy when
  // it holds one, else from what this test sets as the detail.
  useSession: (id: string) => ({
    data: lists.sessions.find((one) => one.id === id) ?? lists.detail ?? undefined,
  }),
  useBots: ({ select }: { select: (list: { id: string }[]) => unknown }) => ({
    data: select(lists.bots),
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ params, ...props }: { params: { sessionId: string } }) => (
    <a href={`/sessions/${params.sessionId}`} {...props} />
  ),
  useNavigate: () => navigate,
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  navigate.mockReset();
  lists.detail = null;
});

const noBot = () => null;

function openFirst(...ids: string[]) {
  window.localStorage.setItem(
    'oppenheimer.sessions.tabs',
    JSON.stringify(ids.map((id) => `session:${id}`)),
  );
}

describe('the tabs over Sessions', () => {
  it('goes to the neighbour when the tab on screen closes, and to New session after the last', () => {
    lists.sessions = [
      sessionEntity({ id: 'a', name: 'Fix login' }),
      sessionEntity({ id: 'b', name: 'New website' }),
    ];
    openFirst('a', 'b');
    render(<SessionTabs shown={{ kind: 'session', id: 'a' }} bot={noBot} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'sessions.tabs.close' })[0]);
    expect(navigate).toHaveBeenLastCalledWith({
      to: '/sessions/$sessionId',
      params: { sessionId: 'b' },
    });

    cleanup();
    lists.sessions = [sessionEntity({ id: 'b', name: 'New website' })];
    render(<SessionTabs shown={{ kind: 'session', id: 'b' }} bot={noBot} />);
    fireEvent.click(screen.getByRole('button', { name: 'sessions.tabs.close' }));
    expect(navigate).toHaveBeenLastCalledWith({ to: '/sessions/new' });
  });

  it('leaves off a session deleted since its tab opened, and never steps onto it', () => {
    lists.sessions = [
      sessionEntity({ id: 'a', name: 'Fix login' }),
      sessionEntity({ id: 'c', name: 'Retry policy' }),
    ];
    openFirst('a', 'gone', 'c');
    render(<SessionTabs shown={{ kind: 'session', id: 'a' }} bot={noBot} />);

    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Fix login',
      'Retry policy',
    ]);
    fireEvent.click(screen.getAllByRole('button', { name: 'sessions.tabs.close' })[0]);
    expect(navigate).toHaveBeenLastCalledWith({
      to: '/sessions/$sessionId',
      params: { sessionId: 'c' },
    });
  });

  it('keeps the tab of the session on screen when the list leaves it out, a deleted one opened from a link', () => {
    lists.sessions = [sessionEntity({ id: 'b', name: 'New website' })];
    lists.detail = sessionEntity({ id: 'old', name: 'Deleted work' });
    openFirst('b');
    render(<SessionTabs shown={{ kind: 'session', id: 'old' }} bot={noBot} />);

    expect(screen.getByRole('link', { name: 'Deleted work' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('closes a tab not on screen without leaving the page', () => {
    lists.sessions = [
      sessionEntity({ id: 'a', name: 'Fix login' }),
      sessionEntity({ id: 'b', name: 'New website' }),
    ];
    openFirst('a', 'b');
    render(<SessionTabs shown={{ kind: 'session', id: 'a' }} bot={noBot} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'sessions.tabs.close' })[1]);
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['Fix login']);
  });
});
