import { describe, expect, it } from 'vitest';
import {
  PROJECT_SLUG_MAX_LENGTH,
  PROJECT_SLUG_PATTERN,
  projectSlugCandidates,
  projectSlugFromRepositoryName,
} from '../domain/project-slug.policy';

/**
 * A slug is a directory name on every host holding the project, so these are not
 * formatting tests: each case below is a path that either exists on disk or
 * cannot be created at all.
 */
describe('projectSlugFromRepositoryName', () => {
  it('leaves a name that is already a slug alone', () => {
    expect(projectSlugFromRepositoryName('xrp-mobile')).toBe('xrp-mobile');
  });

  it('lower-cases and folds GitHub’s other name characters into dashes', () => {
    // GitHub admits `.`, `_` and `-`; only the last is a directory name.
    expect(projectSlugFromRepositoryName('XRP_Mobile.App')).toBe('xrp-mobile-app');
  });

  it('collapses runs of separators and trims the ends', () => {
    expect(projectSlugFromRepositoryName('--xrp___mobile--')).toBe('xrp-mobile');
  });

  it('never returns an empty slug', () => {
    // `...` is a legal repository name and sanitises to nothing.
    expect(projectSlugFromRepositoryName('...')).toBe('project');
    expect(projectSlugFromRepositoryName('')).toBe('project');
  });

  it('truncates a long name without leaving a trailing dash', () => {
    const slug = projectSlugFromRepositoryName(`${'a'.repeat(PROJECT_SLUG_MAX_LENGTH)}-tail`);

    expect(slug).toHaveLength(PROJECT_SLUG_MAX_LENGTH);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('projectSlugCandidates', () => {
  const acme = { owner: 'acme', name: 'xrp-mobile', githubRepoId: '821374923' };

  it('offers the repository name, then owner--repo, then owner--repo-id', () => {
    // All three derived from the repository, in this order, so a directory can
    // always be read back to the repository it belongs to.
    expect(projectSlugCandidates(acme)).toEqual([
      'xrp-mobile',
      'acme--xrp-mobile',
      'acme--xrp-mobile-821374923',
    ]);
  });

  it('gives two owners of the same repository name the same first candidate and different seconds', () => {
    // The motivating collision, and how it is resolved without randomness.
    const other = { ...acme, owner: 'other', githubRepoId: '99' };

    expect(projectSlugCandidates(acme)[0]).toBe(projectSlugCandidates(other)[0]);
    expect(projectSlugCandidates(other)[1]).toBe('other--xrp-mobile');
  });

  it('is deterministic: the same repository always derives the same candidates', () => {
    expect(projectSlugCandidates(acme)).toEqual(projectSlugCandidates(acme));
  });

  it('produces candidates the aggregate accepts, for every shape', () => {
    const sources = [
      acme,
      { owner: 'Acme.Inc', name: 'XRP_Mobile.App', githubRepoId: '1' },
      { owner: '...', name: '...', githubRepoId: '0' },
      { owner: 'a'.repeat(80), name: 'b'.repeat(80), githubRepoId: '1234567890' },
    ];

    for (const source of sources) {
      for (const candidate of projectSlugCandidates(source)) {
        expect(candidate).toMatch(PROJECT_SLUG_PATTERN);
        expect(candidate.length).toBeLessThanOrEqual(PROJECT_SLUG_MAX_LENGTH);
      }
    }
  });

  it('keeps GitHub’s id whole when the qualified name has to be cut', () => {
    const long = { owner: 'a'.repeat(80), name: 'b'.repeat(80), githubRepoId: '821374923' };

    expect(projectSlugCandidates(long).at(-1)?.endsWith('-821374923')).toBe(true);
  });

  it('offers no candidate twice', () => {
    // A repository whose owner and name sanitise alike must not spend two
    // attempts on one directory name.
    const same = { owner: 'x', name: 'x', githubRepoId: '7' };

    expect(new Set(projectSlugCandidates(same)).size).toBe(projectSlugCandidates(same).length);
  });
});
