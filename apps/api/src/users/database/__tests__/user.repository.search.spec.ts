import { describe, expect, it, vi } from 'vitest';
import { UserMapper } from '../../user.mapper';
import { UserRepository } from '../user.repository';

function repositoryWith() {
  const findAndCount = vi.fn().mockResolvedValue([[], 0]);
  const repository = new UserRepository(
    { findAndCount } as never,
    new UserMapper(),
    {} as never,
  );
  return { repository, findAndCount };
}

/** The `where` of the one `findAndCount` call, as `[column, ILIKE operand]` pairs. */
function searchedColumns(findAndCount: ReturnType<typeof vi.fn>) {
  const [{ where }] = findAndCount.mock.calls[0] as [{ where: Record<string, unknown>[] }];
  return where.map((clause) =>
    Object.entries(clause).map(([column, operator]) => [
      column,
      (operator as { type: string; value: string }).type,
      (operator as { type: string; value: string }).value,
    ]),
  );
}

describe('UserRepository.findUsers search', () => {
  it('matches the term literally in each column: `_` and `%` are not wildcards', async () => {
    const { repository, findAndCount } = repositoryWith();

    await repository.findUsers({ page: 1, limit: 20, search: 'a_b%' });

    expect(searchedColumns(findAndCount)).toEqual([
      [['firstName', 'ilike', '%a\\_b\\%%']],
      [['lastName', 'ilike', '%a\\_b\\%%']],
      [['email', 'ilike', '%a\\_b\\%%']],
    ]);
  });

  it('keeps the role filter on every branch of the OR', async () => {
    const { repository, findAndCount } = repositoryWith();

    await repository.findUsers({ page: 1, limit: 20, role: 'admin', search: 'ada' });

    const [{ where }] = findAndCount.mock.calls[0] as [{ where: Record<string, unknown>[] }];
    expect(where).toHaveLength(3);
    for (const clause of where) expect(clause.role).toBe('admin');
  });

  it('searches nothing without a term', async () => {
    const { repository, findAndCount } = repositoryWith();

    await repository.findUsers({ page: 2, limit: 10 });

    expect(findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, skip: 10, take: 10 }),
    );
  });
});
