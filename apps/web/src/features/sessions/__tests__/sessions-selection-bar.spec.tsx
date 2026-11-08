import { ProjectEntity } from '@oppenheimer/frontend-consumer';
import { sessionEntity } from '@oppenheimer/frontend-consumer/testing';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SessionSelectionContext,
  type SessionSelectionStore,
} from '../hooks/use-session-selection';
import { SessionsSelectionBar } from '../sections/sessions-selection-bar';

/**
 * The selection bar's Move searches the projects the way a row's own menu
 * does: when every picked row is in one project, that project is found, ticked
 * as current and not a target, rather than a pick that quietly moves nothing.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const mutateAsync = vi.fn(async () => {});
vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useMoveSession: () => ({ mutateAsync, isPending: false }),
}));
vi.mock('@oppenheimer/frontend-web', () => ({ notifySuccess: vi.fn() }));

afterEach(() => {
  cleanup();
  mutateAsync.mockClear();
});

const project = (id: string, name: string) =>
  new ProjectEntity(id, name, id, id === 'u', null, null, [], new Date(), new Date());

const projects = [
  project('p1', 'Superseo'),
  project('p2', 'XRP Mobile'),
  project('u', 'Unassigned'),
];

function renderBar(picked: { id: string; projectId: string }[]) {
  const ids = picked.map((row) => row.id);
  const store: SessionSelectionStore = {
    subscribe: () => () => {},
    ids: () => ids,
    pick: () => {},
    setOrder: () => {},
    keep: () => {},
    clear: () => {},
  };
  render(
    <SessionSelectionContext.Provider value={store}>
      <SessionsSelectionBar
        sessions={picked.map((row) => sessionEntity(row))}
        projects={projects}
        onDelete={() => {}}
        onWrite={() => {}}
      />
    </SessionSelectionContext.Provider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'sessions.selection.move' }));
}

describe('SessionsSelectionBar move', () => {
  it('ticks the project every picked row is in, and does not move them there', () => {
    renderBar([
      { id: 'a', projectId: 'p1' },
      { id: 'b', projectId: 'p1' },
    ]);

    fireEvent.change(screen.getByRole('combobox', { name: 'common.search.projects' }), {
      target: { value: 'super' },
    });
    const current = screen.getByRole('option', { name: /Superseo/ });
    expect(current.getAttribute('aria-selected')).toBe('true');
    expect(current.getAttribute('aria-disabled')).toBe('true');
    expect(current.textContent).toContain('sessions.sidebar.moveCurrent');

    fireEvent.click(current);
    expect(mutateAsync).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('combobox', { name: 'common.search.projects' }), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('option', { name: 'XRP Mobile' }));
    expect(mutateAsync).toHaveBeenCalledTimes(2);
    expect(mutateAsync).toHaveBeenCalledWith({ id: 'a', projectId: 'p2' });
  });

  it('ticks nothing when the picked rows are spread over projects', () => {
    renderBar([
      { id: 'a', projectId: 'p1' },
      { id: 'b', projectId: 'u' },
    ]);

    for (const row of screen.getAllByRole('option')) {
      expect(row.getAttribute('aria-selected')).toBe('false');
      expect(row.getAttribute('aria-disabled')).toBeNull();
    }
  });
});
