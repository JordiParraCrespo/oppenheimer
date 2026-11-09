import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionRowMenu } from '../components/session-row-menu';

/**
 * Move to project… over a workspace's projects: the pane searches them, so a
 * session reaches the hundredth project as easily as the first. The search
 * sits inside the row's menu, which must not read the typed text as its own
 * typeahead, and a pick moves the session and closes the menu. The project the
 * session is in stays listed, ticked and not a target, so the pane always says
 * where the session is (a pinned row is drawn above its project, not under it).
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

// jsdom draws no layout, so it has no scrollIntoView; the pane calls it on each arrow.
const scrolled = vi.fn();
Element.prototype.scrollIntoView = scrolled;

afterEach(() => {
  cleanup();
  scrolled.mockClear();
});

function renderMenu(currentProjectId: string | null = null) {
  const onMove = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <SessionRowMenu
      open
      onOpenChange={onOpenChange}
      pinned={false}
      onPinChange={() => {}}
      onSelect={() => {}}
      onRename={() => {}}
      onMove={onMove}
      onDelete={() => {}}
      projects={[
        { id: 'p1', name: 'Peersyst security' },
        { id: 'p2', name: 'Superseo' },
        { id: 'p3', name: 'XRP Mobile' },
        { id: 'u', name: 'Unassigned', isUnassigned: true },
      ]}
      currentProjectId={currentProjectId}
    />,
  );
  fireEvent.click(screen.getByText('sessions.sidebar.move'));
  return { onMove, onOpenChange };
}

describe('SessionRowMenu', () => {
  it('narrows the projects as you type and moves the session to the one Enter picks', () => {
    const { onMove, onOpenChange } = renderMenu();
    const search = screen.getByRole('combobox', { name: 'common.search.projects' });

    fireEvent.change(search, { target: { value: 'xrp' } });

    expect(screen.queryByRole('option', { name: 'Superseo' })).toBeNull();
    expect(screen.getByRole('option', { name: 'XRP Mobile' })).toBeTruthy();

    fireEvent.keyDown(search, { key: 'Enter' });

    expect(onMove).toHaveBeenCalledWith('p3');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('tells assistive technology which row Enter will pick, and keeps it in view', () => {
    renderMenu();
    const search = screen.getByRole('combobox', { name: 'common.search.projects' });

    fireEvent.keyDown(search, { key: 'ArrowDown' });

    const row = screen.getByRole('option', { name: 'Superseo' });
    expect(search.getAttribute('aria-activedescendant')).toBe(row.id);
    expect(scrolled.mock.contexts.at(-1)).toBe(row);
  });

  it('says nothing matches rather than showing an empty pane', () => {
    renderMenu();
    fireEvent.change(screen.getByRole('combobox', { name: 'common.search.projects' }), {
      target: { value: 'nope' },
    });

    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('common.search.noMatch')).toBeTruthy();
  });

  it('finds the project the session is in, ticked as current, and does not move it there', () => {
    const { onMove, onOpenChange } = renderMenu('p2');
    const search = screen.getByRole('combobox', { name: 'common.search.projects' });

    fireEvent.change(search, { target: { value: 'superseo' } });

    const row = screen.getByRole('option', { name: /Superseo/ });
    expect(row.getAttribute('aria-selected')).toBe('true');
    expect(row.getAttribute('aria-disabled')).toBe('true');
    expect(row.textContent).toContain('sessions.sidebar.moveCurrent');

    fireEvent.click(row);
    fireEvent.keyDown(search, { key: 'Enter' });

    expect(onMove).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('ticks Unassigned for a session in no project, and moves it to any other', () => {
    const { onMove } = renderMenu('u');

    const unassigned = screen.getByRole('option', { name: /projects\.unassigned/ });
    expect(unassigned.getAttribute('aria-selected')).toBe('true');
    expect(unassigned.getAttribute('aria-disabled')).toBe('true');
    expect(
      screen.getByRole('option', { name: 'Superseo' }).getAttribute('aria-disabled'),
    ).toBeNull();

    fireEvent.click(screen.getByRole('option', { name: 'Superseo' }));

    expect(onMove).toHaveBeenCalledWith('p2');
  });
});
