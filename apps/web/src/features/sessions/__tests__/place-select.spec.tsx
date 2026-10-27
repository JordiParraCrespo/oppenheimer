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

const CLOUDS = [
  {
    value: 'cursor' as const,
    agent: 'cursor' as const,
    label: 'Cursor',
    description: 'ana@example.com',
    connected: true,
  },
];

function renderChip(clouds = CLOUDS) {
  const onHostChange = vi.fn();
  const onPlaceChange = vi.fn();
  const onCloudChange = vi.fn();
  const onConnectCloud = vi.fn();
  render(
    <PlaceSelect
      hosts={HOSTS}
      hostId="host-1"
      place="worktree"
      clouds={clouds}
      cloud={null}
      onHostChange={onHostChange}
      onPlaceChange={onPlaceChange}
      onCloudChange={onCloudChange}
      onConnectCloud={onConnectCloud}
      onAddHost={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'sessions.new.host.label' }));
  return { onHostChange, onPlaceChange, onCloudChange, onConnectCloud };
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

  /**
   * Under the hosts, the clouds (`NewSessionComposer.dc.html`): a vendor with
   * the reader's key is picked outright, as the place; one without sends the
   * reader to connect it rather than starting a session it would refuse.
   */
  it('picks a connected cloud outright, and sends a vendor with no key to connect it', () => {
    const picked = renderChip();
    fireEvent.click(screen.getByRole('option', { name: 'Cursor' }));
    expect(picked.onCloudChange).toHaveBeenCalledWith('cursor');
    expect(picked.onHostChange).not.toHaveBeenCalled();
    cleanup();

    const unconnected = renderChip([{ ...CLOUDS[0], connected: false }]);
    fireEvent.click(screen.getByRole('option', { name: 'Cursor' }));
    expect(unconnected.onConnectCloud).toHaveBeenCalled();
    expect(unconnected.onCloudChange).not.toHaveBeenCalled();
  });

  it('walks from the hosts into the clouds with the arrows', () => {
    const { onCloudChange } = renderChip();
    const search = screen.getByRole('textbox', { name: 'sessions.new.host.search' });

    for (let step = 0; step < 2; step++) fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });

    expect(onCloudChange).toHaveBeenCalledWith('cursor');
  });
});
