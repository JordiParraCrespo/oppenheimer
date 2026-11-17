import { type RepositoryScope, RepositorySelect } from '@oppenheimer/design-system-web';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * The repository chip on New session is picked from the keyboard as well as
 * the pointer: the arrows walk the rows under its search while the focus
 * stays in it, Enter takes the highlighted one, and the field names that row
 * to a screen reader. A regression that dropped the combobox around the pane
 * left the arrows doing nothing and Enter adding no repository.
 */
afterEach(cleanup);

const REPOS = [
  { id: 'xrp-mobile', name: 'xrp-mobile', branches: [{ value: 'main' }, { value: 'release/1' }] },
  { id: 'atlas', name: 'atlas', branches: [{ value: 'main' }] },
  { id: 'flama-ai', name: 'flama-ai', branches: [{ value: 'main' }] },
];

function Chip() {
  const [value, setValue] = useState<RepositoryScope[]>([]);
  return (
    <>
      <RepositorySelect repositories={REPOS} value={value} onValueChange={setValue} />
      <output data-testid="scope">
        {value.map((scope) => `${scope.id}@${scope.branch}`).join(',')}
      </output>
    </>
  );
}

function open() {
  render(<Chip />);
  fireEvent.click(screen.getByRole('button', { name: 'Repositories' }));
  return screen.getByRole('combobox', { name: 'Search repositories…' });
}

const highlighted = () => document.querySelector('[role="option"][data-highlighted]')?.textContent;
const scope = () => screen.getByTestId('scope').textContent;

describe('RepositorySelect from the keyboard', () => {
  it('adds the row the arrows reach, and the field names it to a screen reader', () => {
    const search = open();

    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    expect(highlighted()).toBe('atlas');
    const active = search.getAttribute('aria-activedescendant');
    expect(active && document.getElementById(active)?.textContent).toBe('atlas');

    fireEvent.keyDown(search, { key: 'Enter' });
    expect(scope()).toBe('atlas@main');
  });

  it('walks a repository’s branches in its own pane', () => {
    const search = open();
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });

    fireEvent.click(screen.getByRole('button', { name: 'Change branch: xrp-mobile' }));
    const branches = screen.getByRole('combobox', { name: 'Search branches…' });
    fireEvent.keyDown(branches, { key: 'ArrowDown' });
    fireEvent.keyDown(branches, { key: 'ArrowDown' });
    fireEvent.keyDown(branches, { key: 'Enter' });

    expect(scope()).toBe('xrp-mobile@release/1');
  });
});
