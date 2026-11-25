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
  sessionsPending: false,
}));
const navigate = vi.hoisted(() => vi.fn());

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useSessions: ({ select }: { select: (list: { id: string }[]) => unknown }) =>
    lists.sessionsPending
      ? { data: undefined, isPending: true }
      : { data: select(lists.sessions), isPending: false },
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
  Link: ({ to, params, ...props }: { to: string; params?: { sessionId: string } }) => (
    <a href={params ? `/sessions/${params.sessionId}` : to} {...props} />
  ),
  useNavigate: () => navigate,
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  navigate.mockReset();
  lists.detail = null;
  lists.sessionsPending = false;
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

  it('keeps the open tabs on New session, adds none for it, and lights a New session tab', () => {
    lists.sessions = [sessionEntity({ id: 'a', name: 'Fix login' })];
    openFirst('a');
    render(<SessionTabs shown={null} bot={noBot} />);

    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Fix login', 'sessions.tabs.new']);
    expect(links[1].getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('button', { name: 'sessions.tabs.new' })).toBeNull();
    expect(window.localStorage.getItem('oppenheimer.sessions.tabs')).toBe('["session:a"]');

    fireEvent.click(screen.getByRole('button', { name: 'sessions.tabs.close' }));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('holds the place of a tab whose list is still loading, so the strip does not reflow when it lands', () => {
    lists.detail = sessionEntity({ id: 'a', name: 'Fix login' });
    lists.sessionsPending = true;
    openFirst('a', 'b', 'c');
    const { container } = render(<SessionTabs shown={{ kind: 'session', id: 'a' }} bot={noBot} />);

    // The shown tab from the session itself, and one placeholder for each of the others.
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['Fix login']);
    expect(container.querySelectorAll('[data-slot="chat-tab"]')).toHaveLength(3);
  });
});
