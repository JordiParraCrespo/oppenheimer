import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectDeleteBlockedNote } from '../sections/project-delete-blocked-note';
import { ProjectDeleteButton } from '../sections/project-delete-button';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));

type Row = { projectId: string; lifecycle: 'starting' | 'open' | 'failed' };
// `undefined` is the list still loading; rows are what it yields once it has
// left resolved sessions out.
const list = vi.hoisted(() => ({ rows: undefined as Row[] | undefined }));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useSessions: ({ select }: { select: (rows: Row[]) => unknown }) => ({
    data: list.rows === undefined ? undefined : select(list.rows),
  }),
}));

function renderDelete() {
  render(
    <>
      <ProjectDeleteBlockedNote projectId="project-1" />
      <ProjectDeleteButton projectId="project-1" disabled={false} onDelete={vi.fn()} />
    </>,
  );
  return (screen.getByRole('button', { name: 'projects.dialog.delete' }) as HTMLButtonElement)
    .disabled;
}

afterEach(cleanup);

describe('Delete project', () => {
  it('is off and names the count while the project holds sessions', () => {
    list.rows = [
      { projectId: 'project-1', lifecycle: 'open' },
      { projectId: 'project-1', lifecycle: 'failed' },
      { projectId: 'project-2', lifecycle: 'starting' },
    ];
    expect(renderDelete()).toBe(true);
    expect(screen.getByText('projects.dialog.deleteBlocked:2')).toBeTruthy();
  });

  it('stays off and claims nothing while the list is loading', () => {
    list.rows = undefined;
    expect(renderDelete()).toBe(true);
    expect(screen.queryByText(/deleteBlocked/)).toBeNull();
  });

  it('is on with no note when no session holds the project', () => {
    list.rows = [{ projectId: 'project-2', lifecycle: 'open' }];
    expect(renderDelete()).toBe(false);
    expect(screen.queryByText(/deleteBlocked/)).toBeNull();
  });
});
