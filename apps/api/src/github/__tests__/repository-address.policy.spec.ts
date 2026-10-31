import { describe, expect, it } from 'vitest';
import {
  addressFrom,
  addressKeyOf,
  addressOf,
  appAddressOf,
  installationIdOf,
  isInstallationAddress,
} from '../domain/repository-address.policy';

/**
 * The one place a repository address meets the wire and a URL (§6.2): the
 * wire's `installationId: null` and the URL's `tokens` both mean the
 * caller's own tokens. A translation that lost the kind would send a token
 * repository down the App's path, or the reverse, with nothing failing.
 */
describe('a repository address at the edges', () => {
  it('round-trips through the wire’s two fields, either kind', () => {
    const installed = { kind: 'installation' as const, installationId: 'inst', githubRepoId: 7 };
    const tokens = { kind: 'tokens' as const, githubRepoId: 9 };

    expect(addressOf(installationIdOf(installed), 7)).toEqual(installed);
    expect(addressOf(installationIdOf(tokens), 9)).toEqual(tokens);
    expect(installationIdOf(tokens)).toBeNull();
  });

  it('is built from a route’s source segment', () => {
    expect(addressFrom({ kind: 'tokens' }, 9)).toEqual({ kind: 'tokens', githubRepoId: 9 });
    expect(addressFrom({ kind: 'installation', installationId: 'inst' }, 7)).toEqual({
      kind: 'installation',
      installationId: 'inst',
      githubRepoId: 7,
    });
  });

  // A watch through tokens and one through an installation are two watches.
  it('keys the same repository apart by how it is reached', () => {
    expect(addressKeyOf({ kind: 'tokens', githubRepoId: 7 })).not.toBe(
      addressKeyOf({ kind: 'installation', installationId: 'inst', githubRepoId: 7 }),
    );
  });

  it('tells an App address from a token one', () => {
    expect(isInstallationAddress({ kind: 'tokens', githubRepoId: 7 })).toBe(false);
    expect(
      isInstallationAddress({ kind: 'installation', installationId: 'inst', githubRepoId: 7 }),
    ).toBe(true);
  });

  // Sessions and writes go through the App, which a token repository has none of.
  it('narrows to the App, or answers the refusal a token address is owed', () => {
    const app = { kind: 'installation' as const, installationId: 'inst', githubRepoId: 7 };

    expect(appAddressOf(app)).toBe(app);
    expect(appAddressOf({ kind: 'tokens', githubRepoId: 99 })).toEqual({
      kind: 'refused',
      error: expect.objectContaining({ code: 'GITHUB_022' }),
      detail: 'Repository 99 is read through your own GitHub token.',
    });
  });
});
