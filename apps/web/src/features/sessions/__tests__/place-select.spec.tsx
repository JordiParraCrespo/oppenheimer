import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlaceSelect } from '../components/place-select';

/**
 * The place chip picks a host and where on it in one go: a host opens its
 * Start in pane, and the place picked there carries the host with it. A
 * regression that picked the place alone would start the session on the
 * host the chip showed before.
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

const HOSTS = [
  { value: 'host-1', label: 'mac-studio', online: true },
  { value: 'host-2', label: 'optimus', online: false },
];

function renderChip() {
  const onHostChange = vi.fn();
  const onPlaceChange = vi.fn();
  render(
    <PlaceSelect
      hosts={HOSTS}
      hostId="host-1"
      place="worktree"
      onHostChange={onHostChange}
      onPlaceChange={onPlaceChange}
      onAddHost={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'sessions.new.host.label' }));
  return { onHostChange, onPlaceChange };
}

describe('PlaceSelect', () => {
  it('picks the host with the place chosen on its pane', () => {
    const { onHostChange, onPlaceChange } = renderChip();

    fireEvent.click(screen.getByRole('option', { name: 'optimus' }));
    fireEvent.click(screen.getByRole('option', { name: /sessions.new.where.folder.label/ }));

    expect(onHostChange).toHaveBeenCalledWith('host-2');
    expect(onPlaceChange).toHaveBeenCalledWith('folder');
  });

  it('changes only the place on the current host', () => {
    const { onHostChange, onPlaceChange } = renderChip();

    fireEvent.click(screen.getByRole('option', { name: 'mac-studio' }));
    fireEvent.click(screen.getByRole('option', { name: /sessions.new.where.folder.label/ }));

    expect(onHostChange).not.toHaveBeenCalled();
    expect(onPlaceChange).toHaveBeenCalledWith('folder');
  });

  /** Keys as in `ChipSelect`: the arrows walk the list under the search, Enter takes the row. */
  it('picks a host and a place from the keyboard', () => {
    const { onHostChange, onPlaceChange } = renderChip();
    const search = screen.getByRole('textbox', { name: 'sessions.new.host.search' });

    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });

    expect(onHostChange).toHaveBeenCalledWith('host-2');
    expect(onPlaceChange).toHaveBeenCalledWith('folder');
  });
});
