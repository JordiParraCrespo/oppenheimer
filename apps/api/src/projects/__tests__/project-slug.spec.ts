import { describe, expect, it } from 'vitest';
import {
  PROJECT_SLUG_MAX_LENGTH,
  PROJECT_SLUG_PATTERN,
  PROJECT_SLUG_SUFFIX_LENGTH,
  projectSlugFromRepositoryName,
  withSuffix,
} from '../domain/project-slug.policy';

/**
 * A slug is a directory name on every host holding the project, so these are
 * not formatting tests: each case below is a path that either exists on disk or
 * cannot be created at all.
 */
describe('projectSlugFromRepositoryName', () => {
  it('leaves a name that is already a slug alone', () => {
    expect(projectSlugFromRepositoryName('xrp-mobile')).toBe('xrp-mobile');
  });

  it('takes the repository from an owner/repo pair', () => {
    expect(projectSlugFromRepositoryName('acme/xrp-mobile')).toBe('xrp-mobile');
  });

  it('lower-cases and folds GitHub’s other name characters into dashes', () => {
    // GitHub admits `.`, `_` and `-`; only the last is a directory name.
    expect(projectSlugFromRepositoryName('Acme/XRP_Mobile.App')).toBe('xrp-mobile-app');
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

  it('produces a slug the aggregate accepts, for every shape above', () => {
    for (const name of ['xrp-mobile', 'Acme/XRP_Mobile.App', '--x--', '...', '9']) {
      expect(projectSlugFromRepositoryName(name)).toMatch(PROJECT_SLUG_PATTERN);
    }
  });

  it('derives the same slug for the same repository name under two owners', () => {
    // The motivating collision: the suffix below is what resolves it, and
    // encoding the owner into every path is what we are declining to do.
    expect(projectSlugFromRepositoryName('acme/xrp-mobile')).toBe(
      projectSlugFromRepositoryName('other/xrp-mobile'),
    );
  });
});

describe('withSuffix', () => {
  it('appends a short base36 suffix', () => {
    expect(withSuffix('xrp-mobile')).toMatch(
      new RegExp(`^xrp-mobile-[0-9a-z]{${PROJECT_SLUG_SUFFIX_LENGTH}}$`),
    );
  });

  it('is still a valid slug', () => {
    expect(withSuffix('xrp-mobile')).toMatch(PROJECT_SLUG_PATTERN);
  });

  it('differs between calls, so a retry is a fresh candidate', () => {
    const candidates = new Set(Array.from({ length: 24 }, () => withSuffix('xrp-mobile')));

    // A suffix that repeated would make the retry loop spin on the same taken
    // slug instead of trying a new one.
    expect(candidates.size).toBeGreaterThan(20);
  });

  it('suffixes a name that is already at the length limit', () => {
    const suffixed = withSuffix('a'.repeat(PROJECT_SLUG_MAX_LENGTH));

    expect(suffixed.length).toBeLessThanOrEqual(PROJECT_SLUG_MAX_LENGTH);
    expect(suffixed).toMatch(PROJECT_SLUG_PATTERN);
  });

  it('does not stack on a name whose truncation ends in a dash', () => {
    const suffixed = withSuffix(`${'a'.repeat(PROJECT_SLUG_MAX_LENGTH - 6)}-bbbbb`);

    expect(suffixed).toMatch(PROJECT_SLUG_PATTERN);
    expect(suffixed).not.toContain('--');
  });
});
