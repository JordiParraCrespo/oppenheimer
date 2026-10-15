import type { HostFolders } from '@oppenheimer/frontend-consumer';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { type ComponentProps, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FolderBrowser } from '../components/folder-browser';

/**
 * New session's folder picker (`product/versions/mvp/24-session-places.md`
 * §4), given what the host listed: it narrows as a path is typed, drills in
 * on a row, says why a folder has no rows, and opens only a folder the host
 * said exists. The section above reads the host; this is what it draws.
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, args?: Record<string, unknown>) =>
      args ? `${key}${JSON.stringify(args)}` : key,
  }),
  // The kit's i18n concern registers itself on import.
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

afterEach(cleanup);

const NOW = Date.parse('2026-10-14T12:00:00Z');

const HOME_LISTING: HostFolders = {
  path: '/home/jordi',
  parent: '/home',
  home: '/home/jordi',
  branch: null,
  entries: [
    { name: 'code', path: '/home/jordi/code', branch: null },
    { name: 'notes', path: '/home/jordi/notes', branch: null },
    { name: 'atlas', path: '/home/jordi/atlas', branch: 'main' },
  ],
  truncated: false,
  recent: [{ path: '/home/jordi/code/ledger', lastUsedAt: new Date(NOW - 2 * 3_600_000) }],
};

/** The browser with its input fed back, as the section feeds it. */
function Harness(props: Partial<ComponentProps<typeof FolderBrowser>> & { initial?: string }) {
  const { initial = '~', ...rest } = props;
  const [input, setInput] = useState(initial);
  return (
    <FolderBrowser
      input={input}
      onInputChange={setInput}
      hostName="studio"
      home="/home/jordi"
      listing={HOME_LISTING}
      missing={false}
      loading={false}
      now={NOW}
      onUse={vi.fn()}
      {...rest}
    />
  );
}

const field = () => screen.getByRole<HTMLInputElement>('textbox');
const useButton = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: /^sessions\.new\.folder\.use/ });

describe('FolderBrowser', () => {
  it('lists the folders of home, the recent ones above them, and uses home itself', () => {
    const onUse = vi.fn();
    render(<Harness onUse={onUse} />);

    expect(screen.getByText('code')).toBeDefined();
    expect(screen.getByText('~/code/ledger')).toBeDefined();
    expect(screen.getByText('common.relative.hour{"count":2}')).toBeDefined();
    expect(screen.getByText('sessions.new.folder.footFolder')).toBeDefined();

    fireEvent.click(useButton());
    expect(onUse).toHaveBeenCalledWith('/home/jordi');
  });

  it('opens a recent folder in one click', () => {
    const onUse = vi.fn();
    render(<Harness onUse={onUse} />);

    fireEvent.click(screen.getByText('~/code/ledger'));
    expect(onUse).toHaveBeenCalledWith('/home/jordi/code/ledger');
  });

  it('narrows to the names that start with what is typed after the last slash', () => {
    render(<Harness />);

    fireEvent.change(field(), { target: { value: '~/no' } });

    expect(screen.getByText('notes')).toBeDefined();
    expect(screen.queryByText('code')).toBeNull();
    // Recent folders belong to the start, not to a search.
    expect(screen.queryByText('~/code/ledger')).toBeNull();
    // `no` is not a folder yet: nothing to use.
    expect(useButton().disabled).toBe(true);
    expect(screen.getByText('sessions.new.folder.footMissing')).toBeDefined();
  });

  it('says nothing starts so when the narrowing leaves no row', () => {
    render(<Harness initial="~/zz" />);

    expect(
      screen.getByText('sessions.new.folder.emptyFiltered{"dir":"~","fragment":"zz"}'),
    ).toBeDefined();
  });

  it('uses a typed name that is a folder, saying it is a repository on its branch', () => {
    const onUse = vi.fn();
    render(<Harness initial="~/atlas" onUse={onUse} />);

    expect(screen.getByText('sessions.new.folder.footRepository{"branch":"main"}')).toBeDefined();
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(onUse).toHaveBeenCalledWith('/home/jordi/atlas');
  });

  it('drills into a folder on a click, as its path with a trailing slash', () => {
    render(<Harness />);

    fireEvent.click(screen.getByText('code'));

    expect(field().value).toBe('~/code/');
  });

  it('goes up and along the crumbs', () => {
    render(<Harness initial="~/code/atlas/" listing={undefined} loading />);

    fireEvent.click(screen.getByRole('button', { name: 'code' }));
    expect(field().value).toBe('~/code/');

    fireEvent.click(screen.getByRole('button', { name: 'sessions.new.folder.up' }));
    expect(field().value).toBe('~');
  });

  it('says there is no such folder, and will not use it', () => {
    render(<Harness initial="~/gone/" listing={undefined} missing />);

    expect(
      screen.getByText('sessions.new.folder.emptyMissing{"dir":"~/gone","host":"studio"}'),
    ).toBeDefined();
    expect(useButton().disabled).toBe(true);
  });

  it('says there are no subfolders in an empty folder, and still uses it', () => {
    const empty = { ...HOME_LISTING, path: '/home/jordi/notes', entries: [], recent: [] };
    render(<Harness initial="~/notes/" listing={empty} />);

    expect(screen.getByText('sessions.new.folder.emptyNone')).toBeDefined();
    expect(useButton().disabled).toBe(false);
  });

  it('shows why the host could not list, instead of rows', () => {
    render(<Harness listing={undefined} failure="The host is offline." />);

    expect(screen.getByRole('alert').textContent).toBe('The host is offline.');
    expect(useButton().disabled).toBe(true);
  });
});
