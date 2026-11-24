import type { ReviewSession } from '@oppenheimer/frontend-consumer';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReviewSessionRow } from '../sections/review-session-row';

/**
 * A review session's row under For review: a right-click opens the row's own
 * menu instead of the browser's, as its ellipsis does, and its Delete hands
 * the session to the list.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, ...props }: { to: string }) => <a href={to} {...props} />,
  useMatchRoute: () => () => false,
}));

const session: ReviewSession = {
  sessionId: 's1',
  installationId: 'i1',
  githubRepoId: 7,
  number: 42,
  repository: 'acme/app',
  title: 'Fix the queue',
  headRef: 'fix-queue',
  hostId: 'h1',
  state: 'running',
  createdAt: new Date('2026-11-23T09:00:00Z'),
};

afterEach(cleanup);

describe('ReviewSessionRow', () => {
  it('opens its own menu on a right-click, not the browser’s', async () => {
    const onDelete = vi.fn();
    render(
      <ReviewSessionRow session={session} now={session.createdAt.getTime()} onDelete={onDelete} />,
    );
    const prevented = !fireEvent.contextMenu(screen.getByRole('link'));
    expect(prevented).toBe(true);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'sessions.sidebar.delete' }));
    expect(onDelete).toHaveBeenCalledWith(session);
  });
});
