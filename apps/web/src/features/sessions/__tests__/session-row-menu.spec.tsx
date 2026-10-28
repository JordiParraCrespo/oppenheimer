import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionRowMenu } from '../components/session-row-menu';

/**
 * Move to project… over a workspace's projects: the pane searches them, so a
 * session reaches the hundredth project as easily as the first. The search
 * sits inside the row's menu, which must not read the typed text as its own
 * typeahead, and a pick moves the session and closes the menu.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

afterEach(cleanup);

function renderMenu() {
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
      ]}
    />,
  );
  fireEvent.click(screen.getByText('sessions.sidebar.move'));
  return { onMove, onOpenChange };
}

describe('SessionRowMenu', () => {
  it('narrows the projects as you type and moves the session to the one Enter picks', () => {
    const { onMove, onOpenChange } = renderMenu();
    const search = screen.getByRole('textbox', { name: 'common.search.projects' });

    fireEvent.change(search, { target: { value: 'xrp' } });

    expect(screen.queryByRole('option', { name: 'Superseo' })).toBeNull();
    expect(screen.getByRole('option', { name: 'XRP Mobile' })).toBeTruthy();

    fireEvent.keyDown(search, { key: 'Enter' });

    expect(onMove).toHaveBeenCalledWith('p3');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('says nothing matches rather than showing an empty pane', () => {
    renderMenu();
    fireEvent.change(screen.getByRole('textbox', { name: 'common.search.projects' }), {
      target: { value: 'nope' },
    });

    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('common.search.noMatch')).toBeTruthy();
  });
});
