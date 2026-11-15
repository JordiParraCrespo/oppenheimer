import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsList } from '../sections/projects-list';

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; name?: string }) =>
      [key, options?.count, options?.name].filter((part) => part !== undefined).join(':'),
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children?: ReactNode }) => (
    <a href="/project" {...props}>
      {children}
    </a>
  ),
}));

const api = vi.hoisted(() => ({
  archive: vi.fn<(id: string) => Promise<unknown>>(),
  projects: [] as unknown[],
  sessions: [] as unknown[],
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useSuspenseSessionsSidebar: () => ({
    projects: api.projects,
    sessions: api.sessions,
    hosts: [],
    error: null,
  }),
  useArchiveProject: () => ({ mutateAsync: api.archive }),
}));

vi.mock('@oppenheimer/frontend-web', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@oppenheimer/frontend-web')>()),
  notifySuccess: vi.fn(),
}));

function project(id: string, name: string, isUnassigned = false) {
  return { id, name, isUnassigned, repositories: [] };
}

beforeEach(() => {
  api.archive.mockReset();
  api.projects = [
    project('p1', 'Atlas'),
    project('p2', 'Coverd'),
    project('p3', 'Busy'),
    project('un', 'Unassigned', true),
  ];
  api.sessions = [{ projectId: 'p3', state: 'working' }];
});

afterEach(cleanup);

describe('Projects bulk delete', () => {
  it('offers no checkbox for Unassigned or a project an open session holds', () => {
    render(<ProjectsList onNew={vi.fn()} />);
    expect(
      screen.getByRole('checkbox', { name: 'projects.selection.selectOne:Atlas' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('checkbox', { name: 'projects.selection.selectOne:Coverd' }),
    ).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /Busy/ })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /projects.unassigned/ })).toBeNull();
  });

  it('picks by checkbox, then by a click on a card, and deletes every one picked', async () => {
    api.archive.mockResolvedValue({});
    render(<ProjectsList onNew={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'projects.selection.selectOne:Atlas' }));
    // Once one is picked, a click on another card picks it instead of opening it.
    fireEvent.click(screen.getByText('Coverd'));
    expect(screen.getByText('projects.selection.count:2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'projects.selection.delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'projects.deleteProjects.confirm:2' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(api.archive.mock.calls.map(([id]) => id).sort()).toEqual(['p1', 'p2']);
  });

  it('keeps the ones a delete failed on picked, and says how many', async () => {
    api.archive.mockImplementation((id) =>
      id === 'p2' ? Promise.reject(new Error('refused')) : Promise.resolve({}),
    );
    render(<ProjectsList onNew={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'projects.selection.selectOne:Atlas' }));
    fireEvent.click(screen.getByRole('button', { name: 'projects.selection.selectAll' }));
    fireEvent.click(screen.getByRole('button', { name: 'projects.selection.delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'projects.deleteProjects.confirm:2' }));

    expect(await screen.findByText('projects.deleteProjects.partial:1')).toBeTruthy();
    expect(screen.getByText('projects.selection.count:1')).toBeTruthy();
  });
});
