import type { WatchedRepository } from '@oppenheimer/frontend-consumer';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueueEmpty } from '../sections/queue-empty';

/**
 * An empty queue sends the reader to Settings only when nothing is watched.
 * Watched repositories with no open pull request are an empty queue: telling
 * that reader to watch something (the bug this guards) sends them to a
 * setting they already made.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children?: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

const watched = vi.hoisted(() => ({ rows: undefined as WatchedRepository[] | undefined }));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useWatchedRepositories: ({ select }: { select: (rows: WatchedRepository[]) => unknown }) => ({
    data: watched.rows === undefined ? undefined : select(watched.rows),
  }),
}));

const repository = (watching: boolean) => ({ watching }) as WatchedRepository;

afterEach(() => {
  cleanup();
  watched.rows = undefined;
});

describe('QueueEmpty', () => {
  it('asks the reader to watch a repository when All is empty and nothing is watched', () => {
    watched.rows = [repository(false)];
    render(<QueueEmpty queue="all" />);
    expect(screen.getByText('pullRequests.queue.emptyWatchingTitle')).toBeTruthy();
    expect(screen.getByText('pullRequests.queue.configureWatched')).toBeTruthy();
  });

  it('says the queue is empty when watched repositories have no open pull request', () => {
    watched.rows = [repository(true), repository(false)];
    render(<QueueEmpty queue="all" />);
    expect(screen.getByText('pullRequests.queue.emptyTitle')).toBeTruthy();
    expect(screen.queryByText('pullRequests.queue.configureWatched')).toBeNull();
  });

  it('says the queue is empty while the watched repositories are still unanswered', () => {
    render(<QueueEmpty queue="watching" />);
    expect(screen.getByText('pullRequests.queue.emptyTitle')).toBeTruthy();
  });

  it('never asks for a watch on Mine, which is not about what is watched', () => {
    watched.rows = [];
    render(<QueueEmpty queue="mine" />);
    expect(screen.getByText('pullRequests.queue.emptyTitle')).toBeTruthy();
  });
});
