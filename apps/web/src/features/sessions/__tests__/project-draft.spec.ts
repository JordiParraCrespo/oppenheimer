import { describe, expect, it } from 'vitest';
import { projectBlock, repositorySummary } from '../lib/project-draft';

const row = (id: string, isDefault: boolean) => ({ id, isDefault, branch: 'main' });

describe('projectBlock', () => {
  it('asks for a name first, then a repository, then a default', () => {
    expect(projectBlock('  ', { rows: [], defaultHostId: null, defaultAgent: null })).toBe('name');
    expect(projectBlock('XRP', { rows: [], defaultHostId: null, defaultAgent: null })).toBe(
      'repositories',
    );
    expect(
      projectBlock('XRP', { rows: [row('a', false)], defaultHostId: null, defaultAgent: null }),
    ).toBe('default');
  });

  it('is ready once a named project holds a default repository', () => {
    expect(
      projectBlock('XRP', {
        rows: [row('a', true), row('b', false)],
        defaultHostId: null,
        defaultAgent: null,
      }),
    ).toBeNull();
  });
});

describe('repositorySummary', () => {
  it('counts the rows and the defaults among them', () => {
    expect(repositorySummary([row('a', true), row('b', false)])).toEqual({
      count: 2,
      defaults: 1,
    });
  });

  it('lets the Unassigned project save with no repository, but not with no default', () => {
    const draft = { rows: [], defaultHostId: 'host-1', defaultAgent: null };
    expect(projectBlock('Unassigned', draft, { holdsNone: true })).toBeNull();
    expect(
      projectBlock(
        'Unassigned',
        { ...draft, rows: [{ id: 'inst:1', isDefault: false, branch: 'main' }] },
        { holdsNone: true },
      ),
    ).toBe('default');
  });
});
