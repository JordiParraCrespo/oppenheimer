import { describe, expect, it } from 'vitest';
import {
  compactPath,
  crumbsOf,
  expandPath,
  parentOf,
  parseFolderInput,
  shortenPath,
} from '../lib/folder-path';

/**
 * The folder picker shows a host's paths under its home as `~/…` and takes
 * `~` back; a typed path is the folder to list plus the start of a name.
 */
describe('folder paths', () => {
  const home = '/home/jordi';

  it('shortens a path under home, and only under home', () => {
    expect(shortenPath('/home/jordi', home)).toBe('~');
    expect(shortenPath('/home/jordi/code', home)).toBe('~/code');
    expect(shortenPath('/home/jordian', home)).toBe('/home/jordian');
    expect(shortenPath('/home/jordi/code', null)).toBe('/home/jordi/code');
  });

  it('compacts a path to its root and the folder it names', () => {
    expect(compactPath('~/oppenheimer-ai/workspaces/jordi/atlas')).toBe('~/…/atlas');
    expect(compactPath('/srv/apps/atlas/')).toBe('/…/atlas');
    expect(compactPath('~/code')).toBe('~/code');
    expect(compactPath('~/code/')).toBe('~/code');
    expect(compactPath('/')).toBe('/');
    expect(compactPath('~')).toBe('~');
  });

  it('expands ~ once the home is known, and waits without it', () => {
    expect(expandPath('~', home)).toBe('/home/jordi');
    expect(expandPath('~/code', home)).toBe('/home/jordi/code');
    expect(expandPath('/srv', null)).toBe('/srv');
    expect(expandPath('~/code', null)).toBeUndefined();
  });

  it.each([
    ['', '~', ''],
    ['~', '~', ''],
    ['/', '/', ''],
    ['~/code/', '~/code', ''],
    ['~/code/at', '~/code', 'at'],
    ['/us', '/', 'us'],
    ['notes', '~', 'notes'],
  ])('reads %j as the folder %j and the start %j', (input, dir, fragment) => {
    expect(parseFolderInput(input)).toEqual({ dir, fragment });
  });

  it('crumbs a path from its root', () => {
    expect(crumbsOf('~/code/atlas').map((crumb) => crumb.dir)).toEqual([
      '~',
      '~/code',
      '~/code/atlas',
    ]);
    expect(crumbsOf('/srv/app').map((crumb) => crumb.name)).toEqual(['/', 'srv', 'app']);
  });

  it('goes up past home once it is known, and not past the root', () => {
    expect(parentOf('~/code', home)).toBe('~');
    expect(parentOf('~', home)).toBe('/home');
    expect(parentOf('/', home)).toBeNull();
  });
});
