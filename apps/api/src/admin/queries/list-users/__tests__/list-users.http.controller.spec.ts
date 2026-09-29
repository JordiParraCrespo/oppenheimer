import type { QueryBus } from '@nestjs/cqrs';
import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListUsersHttpController } from '../list-users.http.controller';
import { ListUsersQuery } from '../list-users.query';

const req = { headers: { cookie: 'session=abc' } } as unknown as Request;

describe('ListUsersHttpController', () => {
  const execute = vi.fn();
  let controller: ListUsersHttpController;

  beforeEach(() => {
    execute.mockReset().mockResolvedValue({ users: [], total: 0, limit: null, offset: null });
    controller = new ListUsersHttpController({ execute } as unknown as QueryBus);
  });

  it('dispatches the list, converting numeric query strings', async () => {
    await controller.listUsers(req, 'ali', 'email', '20', '5', 'name', 'asc');

    const query = execute.mock.calls[0][0] as ListUsersQuery;
    expect(query).toBeInstanceOf(ListUsersQuery);
    expect(query.headers).toBe(req.headers);
    expect(query.filters).toEqual({
      searchValue: 'ali',
      searchField: 'email',
      limit: 20,
      offset: 5,
      sortBy: 'name',
      sortDirection: 'asc',
    });
  });

  it('passes undefined limit/offset when the query params are absent', async () => {
    await controller.listUsers(req);

    const query = execute.mock.calls[0][0] as ListUsersQuery;
    expect(query.filters.limit).toBeUndefined();
    expect(query.filters.offset).toBeUndefined();
  });
});
