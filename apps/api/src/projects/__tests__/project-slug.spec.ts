import { describe, expect, it } from 'vitest';
import {
  PROJECT_SLUG_MAX_LENGTH,
  PROJECT_SLUG_PATTERN,
  projectSlugCandidates,
  projectSlugFromName,
} from '../domain/project-slug.policy';

/** A slug is a project's stable handle: derived once, URL-safe, never reissued. */
describe('projectSlugFromName', () => {
  it.each([
    ['leaves a name that is already a slug alone', 'xrp-mobile', 'xrp-mobile'],
    [
      'lower-cases and folds everything else into single dashes',
      'XRP  Mobile_App.v2',
      'xrp-mobile-app-v2',
    ],
    ['trims the ends', '--Client sites!--', 'client-sites'],
    ['never returns an empty slug', '...', 'project'],
    ['never returns an empty slug, even for nothing', '', 'project'],
  ])('%s', (_case, name, slug) => {
    expect(projectSlugFromName(name)).toBe(slug);
  });

  it('truncates a long name without leaving a trailing dash', () => {
    const slug = projectSlugFromName(`${'a'.repeat(PROJECT_SLUG_MAX_LENGTH)}-tail`);

    expect(slug).toHaveLength(PROJECT_SLUG_MAX_LENGTH);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('projectSlugCandidates', () => {
  const id = '3f9a7b2c-1d4e-4f60-8a9b-0c1d2e3f4a5b';

  it('offers the name, then the name with the project’s own id', () => {
    expect(projectSlugCandidates('Client sites', id)).toEqual([
      'client-sites',
      'client-sites-3f9a7b2c',
    ]);
  });

  it('keeps the id whole when the name has to be cut', () => {
    const [, unique] = projectSlugCandidates('a'.repeat(200), id);

    expect(unique).toHaveLength(PROJECT_SLUG_MAX_LENGTH);
    expect(unique.endsWith('-3f9a7b2c')).toBe(true);
    expect(PROJECT_SLUG_PATTERN.test(unique)).toBe(true);
  });

  it('gives an unnameable name the fallback, still derived from the id', () => {
    expect(projectSlugCandidates('!!!', id)).toEqual(['project', 'project-3f9a7b2c']);
  });
});
