import { describe, expect, it } from 'vitest';
import { projectIdsOfSlugs, projectParamOf, projectSlugsOf } from './project-scope';

describe('?project=', () => {
  const projects = [
    { id: 'p-web', slug: 'web', isUnassigned: false },
    { id: 'p-none', slug: 'unassigned-x', isUnassigned: true },
  ];

  it('reads one slug as it always did, and several comma-separated, each once', () => {
    expect(projectSlugsOf('web')).toEqual(['web']);
    expect(projectSlugsOf('web,billing,,web')).toEqual(['web', 'billing']);
    expect(projectSlugsOf(undefined)).toEqual([]);
    expect(projectParamOf([])).toBeUndefined();
    expect(projectParamOf(['web', 'billing'])).toBe('web,billing');
  });

  it('turns slugs into ids, leaving a stale one out but never widening to All projects', () => {
    expect(projectIdsOfSlugs(['web', 'unassigned', 'gone'], projects)).toEqual(['p-web', 'p-none']);
    // Reading `?project=gone` as no filter would show every project's tasks.
    expect(projectIdsOfSlugs(['gone'], projects)).toEqual([]);
    expect(projectIdsOfSlugs([], projects)).toBeUndefined();
  });
});
