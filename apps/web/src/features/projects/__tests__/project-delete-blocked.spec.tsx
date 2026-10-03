import type { ProjectEntity } from '@oppenheimer/frontend-consumer';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectEditorDialog } from '../dialogs/project-editor';

/**
 * Delete project is off while the project holds an open session, and the
 * dialog says why in its body: a disabled button takes no pointer, so the
 * tooltip that used to carry the reason never showed and the button read as
 * broken.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const sessions = vi.hoisted(() => ({
  rows: [] as { projectId: string; lifecycle: string }[],
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useCreateProject: () => ({ mutate: vi.fn(), isPending: false, submittedAt: 0, error: null }),
  useUpdateProject: () => ({ mutate: vi.fn(), isPending: false, submittedAt: 0, error: null }),
  useInstallations: () => ({ data: [], isPending: false, error: null }),
  useInstallationRepositoriesFor: () => ({ repositories: [], isPending: false, error: null }),
  useRepositoryBranchesFor: () => ({ byRepository: new Map(), isPending: false }),
  useHosts: () => ({ data: [], isPending: false }),
  useSessions: ({ select }: { select: (rows: typeof sessions.rows) => unknown }) => ({
    data: select(sessions.rows),
  }),
}));

vi.mock('@oppenheimer/frontend-core/react', async (original) => ({
  ...(await original<typeof import('@oppenheimer/frontend-core/react')>()),
  useErrorMessage: () => (_error: unknown, fallback: string) => ({ message: fallback }),
}));

const project = {
  id: 'project-1',
  name: 'Oppenheimer',
  isUnassigned: false,
  repositories: [],
  defaultHostId: null,
  defaultAgent: null,
} as unknown as ProjectEntity;

function renderDialog() {
  render(<ProjectEditorDialog project={project} onClose={vi.fn()} onSaved={vi.fn()} />);
  return screen.getByRole('button', { name: 'projects.dialog.delete' }) as HTMLButtonElement;
}

afterEach(cleanup);

describe('ProjectEditorDialog, Delete project', () => {
  it('is off and says why while the project holds open sessions', () => {
    sessions.rows = [
      { projectId: 'project-1', lifecycle: 'running' },
      { projectId: 'project-1', lifecycle: 'stopped' },
      { projectId: 'project-1', lifecycle: 'resolved' },
      { projectId: 'project-2', lifecycle: 'running' },
    ];
    expect(renderDialog().disabled).toBe(true);
    expect(screen.getByText('projects.dialog.deleteBlocked:2')).toBeTruthy();
  });

  it('is on with no note once every session is resolved', () => {
    sessions.rows = [{ projectId: 'project-1', lifecycle: 'resolved' }];
    expect(renderDialog().disabled).toBe(false);
    expect(screen.queryByText(/projects\.dialog\.deleteBlocked/)).toBeNull();
  });
});
