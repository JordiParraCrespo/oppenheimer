import { describe, expect, it } from 'vitest';
import { hostsKeys } from '../hosts.queries';
import { installationsKeys } from '../installations.queries';
import { organizationsKeys } from '../organizations.queries';
import { sessionsKeys } from '../sessions.queries';

/** Does `prefix` fuzzy-match `key`, the way `invalidateQueries` would? */
function covers(prefix: readonly unknown[], key: readonly unknown[]): boolean {
  return JSON.stringify(key.slice(0, prefix.length)) === JSON.stringify(prefix);
}

describe('installationsKeys', () => {
  const repositories = installationsKeys.repositories('inst-1');
  const branches = installationsKeys.branches('inst-1', 42);

  it('hangs what GitHub says about an installation off its detail', () => {
    // Removing an installation drops this one subtree and nothing else.
    expect(covers(installationsKeys.detail('inst-1'), repositories)).toBe(true);
    expect(covers(installationsKeys.detail('inst-1'), branches)).toBe(true);
    expect(covers(installationsKeys.detail('inst-2'), branches)).toBe(false);
  });

  it('nests a repository’s branches under the repositories that listed them', () => {
    expect(covers(repositories, branches)).toBe(true);
  });

  it('keeps an id out of the list’s slot', () => {
    expect(covers(installationsKeys.lists(), installationsKeys.detail('list'))).toBe(false);
  });
});

describe('hostsKeys', () => {
  it('puts both halves of Add host under one pairing scope', () => {
    expect(covers(hostsKeys.pairings(), hostsKeys.pairingTokens())).toBe(true);
    expect(covers(hostsKeys.pairings(), hostsKeys.currentPairing('laptop'))).toBe(true);
    expect(covers(hostsKeys.lists(), hostsKeys.pairingTokens())).toBe(false);
  });
});

describe('sessionsKeys', () => {
  it('keeps a start log inside its session, so refreshing the session refreshes it', () => {
    expect(covers(sessionsKeys.detail('s-1'), sessionsKeys.start('s-1', false))).toBe(true);
    expect(sessionsKeys.start('s-1', false)).not.toEqual(sessionsKeys.start('s-1', true));
  });
});

describe('organizationsKeys', () => {
  it('keeps an address check out of the workspace list', () => {
    expect(covers(organizationsKeys.lists(), organizationsKeys.slug('acme'))).toBe(false);
  });
});
