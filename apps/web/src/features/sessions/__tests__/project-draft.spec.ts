import { describe, expect, it } from 'vitest';
import { projectBlock } from '../lib/project-draft';

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
