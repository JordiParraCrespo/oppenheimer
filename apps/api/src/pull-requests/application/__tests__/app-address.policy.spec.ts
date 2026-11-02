import { describe, expect, it } from 'vitest';
import { requireApp } from '../app-address.policy';

/**
 * The refusal the GitHub domain decides (`appAddressOf`, proven in
 * `github/__tests__/repository-address.policy.spec.ts`), raised as the
 * problem the console reads: `GITHUB_022` with the catalog title and the
 * domain's detail, unchanged from when the narrowing was a port method.
 */
describe('an address a review session, a merge or a review needs the App for', () => {
  it('is GITHUB_022, with its title and detail, for one read through a token', () => {
    expect(() => requireApp({ kind: 'tokens', githubRepoId: 99, number: 5 })).toThrow(
      expect.objectContaining({
        code: 'GITHUB_022',
        title: 'This repository is read through your token; act on it on GitHub',
        detail: 'Repository 99 is read through your own GitHub token.',
      }),
    );
  });

  it('is the address itself when the App reaches it', () => {
    const app = {
      kind: 'installation' as const,
      installationId: 'inst',
      githubRepoId: 7,
      number: 5,
    };

    expect(requireApp(app)).toBe(app);
  });
});
