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

function openTab(name: 'hosts' | 'clouds') {
  fireEvent.click(screen.getByRole('tab', { name: new RegExp(`sessions.new.where.${name}`) }));
}

const HOSTS = [
  { value: 'host-1', label: 'mac-studio', online: true },
  { value: 'host-2', label: 'optimus', online: false },
  { value: 'host-3', label: 'old-box', online: true },
];

// As the section judges them: mac-studio can, the other two cannot.
const START_FROM = [
  { ...HOSTS[0], disabled: false, description: 'ana@example.com' },
  { ...HOSTS[1], disabled: true, description: 'Offline' },
  { ...HOSTS[2], disabled: true, description: 'This runner can’t start it' },
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
      startFrom={START_FROM}
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
   * Beside the hosts, the clouds (`NewSessionComposer.dc.html`): a vendor with
   * the reader's key is picked outright, as the place; one without sends the
   * reader to connect it rather than starting a session it would refuse.
   */
  it('picks a connected cloud outright, and sends a vendor with no key to connect it', () => {
    const picked = renderChip();
    openTab('clouds');
    fireEvent.click(screen.getByRole('option', { name: 'Cursor' }));
    expect(picked.onCloudChange).toHaveBeenCalledWith('cursor');
    expect(picked.onHostChange).not.toHaveBeenCalled();
    cleanup();

    const unconnected = renderChip([{ ...CLOUDS[0], connected: false }]);
    openTab('clouds');
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

    openTab('hosts');
    fireEvent.click(screen.getByRole('option', { name: 'mac-studio' }));
    fireEvent.click(screen.getByRole('option', { name: /sessions.new.where.cloud.label/ }));

    expect(onPlaceChange).toHaveBeenCalledWith('cloud');
  });

  /**
   * Claude Code under Cloud opens a Start from pane of every host: the one
   * picked there comes with the place, and one that cannot start it (offline,
   * or a runner that cannot) is disabled rather than sent a session it would
   * refuse. With no host that can, the row itself is greyed out.
   */
  it('starts Claude Code’s cloud from the host picked in its pane, and from none that cannot', () => {
    const picked = renderChip(CLOUDS, { place: 'worktree', cloud: null }, HOSTS[0]);
    openTab('clouds');
    fireEvent.click(screen.getByRole('option', { name: 'sessions.new.where.claudeCloud.label' }));
    expect(picked.onPlaceChange).not.toHaveBeenCalled();

    for (const cannot of ['optimus', 'old-box']) {
      const row = screen.getByRole('option', { name: cannot });
      expect(row).toHaveProperty('disabled', true);
      fireEvent.click(row);
    }
    expect(picked.onHostChange).not.toHaveBeenCalled();

    // The host names the account the session would run on.
    expect(screen.getByRole('option', { name: 'mac-studio' }).textContent).toContain(
      'ana@example.com',
    );
    fireEvent.click(screen.getByRole('option', { name: 'mac-studio' }));
    expect(picked.onPlaceChange).toHaveBeenCalledWith('cloud');
    cleanup();

    const none = renderChip(CLOUDS, { place: 'worktree', cloud: null }, null);
    openTab('clouds');
    const row = screen.getByRole('option', { name: 'sessions.new.where.claudeCloud.label' });
    expect(row).toHaveProperty('disabled', true);
    fireEvent.click(row);
    expect(none.onHostChange).not.toHaveBeenCalled();
    expect(none.onPlaceChange).not.toHaveBeenCalled();
  });

  it('takes Claude Code’s cloud back from Cursor, though the place stays the cloud', () => {
    const { onPlaceChange } = renderChip(CLOUDS, { place: 'cloud', cloud: 'cursor' });

    fireEvent.click(screen.getByRole('option', { name: 'sessions.new.where.claudeCloud.label' }));
    fireEvent.click(screen.getByRole('option', { name: 'mac-studio' }));

    expect(onPlaceChange).toHaveBeenCalledWith('cloud');
  });

  /**
   * The hosts and the clouds are a tab each, and the chip opens on the tab of
   * what is picked: a session already at Cursor opens on Cloud, so the arrows
   * walk the clouds and not hosts the reader is not looking at.
   */
  it('opens on the tab of the pick, and the arrows walk that tab only', () => {
    const { onCloudChange } = renderChip(CLOUDS, { place: 'cloud', cloud: 'cursor' });
    const search = screen.getByRole('textbox', { name: 'sessions.new.where.searchClouds' });
    expect(screen.queryByRole('option', { name: 'mac-studio' })).toBeNull();

    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });

    expect(onCloudChange).toHaveBeenCalledWith('cursor');
  });

  /**
   * Only the hosts wait on their read: the Cloud tab lists the vendors while
   * the hosts load, and holds back only Claude Code, which needs a host.
   */
  it('lists the vendors on Cloud while the hosts load', () => {
    render(
      <PlaceSelect
        hosts={[]}
        hostId={null}
        place="worktree"
        claudeCloud={null}
        startFrom={[]}
        clouds={CLOUDS}
        cloud={null}
        onHostChange={vi.fn()}
        onPlaceChange={vi.fn()}
        onCloudChange={vi.fn()}
        onConnectCloud={vi.fn()}
        onAddHost={vi.fn()}
        loading
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'sessions.new.host.label' }));
    expect(screen.getByText('sessions.new.host.loading')).toBeTruthy();

    openTab('clouds');
    expect(screen.getByRole('option', { name: 'Cursor' })).toBeTruthy();
    expect(
      screen.queryByRole('option', { name: 'sessions.new.where.claudeCloud.label' }),
    ).toBeNull();
  });

  it('counts what each tab holds under the search', () => {
    renderChip();
    fireEvent.change(screen.getByRole('textbox', { name: 'sessions.new.host.search' }), {
      target: { value: 'o' },
    });

    expect(screen.getByRole('tab', { name: /sessions.new.where.hosts/ }).textContent).toContain(
      '3',
    );
    expect(screen.getByRole('tab', { name: /sessions.new.where.clouds/ }).textContent).toContain(
      '2',
    );
  });
});
