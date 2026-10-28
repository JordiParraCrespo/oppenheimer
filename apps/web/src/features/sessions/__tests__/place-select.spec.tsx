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

function renderChip(
  clouds = CLOUDS,
  picked: { place: 'worktree' | 'folder' | 'cloud'; cloud: 'cursor' | null } = {
    place: 'worktree',
    cloud: null,
  },
  claudeCloud: (typeof HOSTS)[number] | null = HOSTS[0],
) {
  const onHostChange = vi.fn();
  const onPlaceChange = vi.fn();
  const onCloudChange = vi.fn();
  const onConnectCloud = vi.fn();
  render(
    <PlaceSelect
      hosts={HOSTS}
      hostId="host-1"
      place={picked.place}
      claudeCloud={claudeCloud}
      clouds={clouds}
      cloud={picked.cloud}
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

  /**
   * Claude Code cloud is a host's place, Cursor a vendor with no host: both
   * are the place `cloud`, so going from Cursor to a host's Claude Code cloud
   * changes no place, and still has to say the host takes the session back.
   */
  it('takes a host’s Claude Code cloud from Cursor, though the place stays the cloud', () => {
    const { onPlaceChange } = renderChip(CLOUDS, { place: 'cloud', cloud: 'cursor' });

    fireEvent.click(screen.getByRole('option', { name: 'mac-studio' }));
    fireEvent.click(screen.getByRole('option', { name: /sessions.new.where.cloud.label/ }));

    expect(onPlaceChange).toHaveBeenCalledWith('cloud');
  });

  /**
   * Claude Code under Cloud starts from a host the section above chose, so the
   * row picks that host with the place; with no host that can, it is greyed
   * out and picks nothing rather than a session the host would refuse.
   */
  it('starts Claude Code’s cloud from the host it names, and from none when there is none', () => {
    const picked = renderChip(CLOUDS, { place: 'worktree', cloud: null }, HOSTS[1]);
    fireEvent.click(screen.getByRole('option', { name: 'sessions.new.where.claudeCloud.label' }));
    expect(picked.onHostChange).toHaveBeenCalledWith('host-2');
    expect(picked.onPlaceChange).toHaveBeenCalledWith('cloud');
    cleanup();

    const none = renderChip(CLOUDS, { place: 'worktree', cloud: null }, null);
    const row = screen.getByRole('option', { name: 'sessions.new.where.claudeCloud.label' });
    expect(row).toHaveProperty('disabled', true);
    fireEvent.click(row);
    expect(none.onHostChange).not.toHaveBeenCalled();
    expect(none.onPlaceChange).not.toHaveBeenCalled();
  });

  it('takes Claude Code’s cloud back from Cursor, though the place stays the cloud', () => {
    const { onPlaceChange } = renderChip(CLOUDS, { place: 'cloud', cloud: 'cursor' });

    fireEvent.click(screen.getByRole('option', { name: 'sessions.new.where.claudeCloud.label' }));

    expect(onPlaceChange).toHaveBeenCalledWith('cloud');
  });

  it('walks from the hosts into the clouds with the arrows', () => {
    const { onCloudChange } = renderChip();
    const search = screen.getByRole('textbox', { name: 'sessions.new.host.search' });

    for (let step = 0; step < 3; step++) fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });

    expect(onCloudChange).toHaveBeenCalledWith('cursor');
  });
});
