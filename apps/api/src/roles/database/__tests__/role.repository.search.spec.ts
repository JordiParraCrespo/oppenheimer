import { describe, expect, it, vi } from 'vitest';
import { RoleMapper } from '../../roles.mapper';
import { RoleRepository } from '../role.repository';

function repositoryWith() {
  const findAndCount = vi.fn().mockResolvedValue([[], 0]);
  const repository = new RoleRepository({ findAndCount } as never, new RoleMapper(), {} as never);
  return { repository, findAndCount };
}

describe('RoleRepository.findRoles search', () => {
  it('matches the term literally in name and description: `_` and `%` are not wildcards', async () => {
    const { repository, findAndCount } = repositoryWith();

    await repository.findRoles({ page: 1, limit: 20, search: 'a_b%' });

    const [{ where }] = findAndCount.mock.calls[0] as [
      { where: Record<string, { type: string; value: string }>[] },
    ];
    const operands = where.flatMap((clause) =>
      ['name', 'description']
        .filter((column) => column in clause)
        .map((column) => [column, clause[column].type, clause[column].value]),
    );
    expect(operands).toEqual(
      expect.arrayContaining([
        ['name', 'ilike', '%a\\_b\\%%'],
        ['description', 'ilike', '%a\\_b\\%%'],
      ]),
    );
    expect(operands.every(([, , value]) => value === '%a\\_b\\%%')).toBe(true);
  });
});
