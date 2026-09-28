import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUserResponseDto } from '../../../dtos/admin-user.response.dto';
import { GetUserQuery } from '../../../queries/get-user/get-user.query';
import { ImpersonateUserCommand } from '../impersonate-user.command';
import { ImpersonateUserHttpController } from '../impersonate-user.http.controller';

const user = { id: 'u1', email: 'a@b.com' } as AdminUserResponseDto;
const req = { headers: { cookie: 'session=abc' } } as unknown as Request;

function makeRes(): Response & { setHeader: ReturnType<typeof vi.fn> } {
  return { setHeader: vi.fn() } as unknown as Response & { setHeader: ReturnType<typeof vi.fn> };
}

describe('ImpersonateUserHttpController', () => {
  const command = vi.fn();
  const query = vi.fn();
  let controller: ImpersonateUserHttpController;

  beforeEach(() => {
    command.mockReset();
    query.mockReset().mockResolvedValue(user);
    controller = new ImpersonateUserHttpController(
      { execute: command } as unknown as CommandBus,
      { execute: query } as unknown as QueryBus,
    );
  });

  it('forwards the impersonation cookie and answers with the user it now acts as', async () => {
    command.mockResolvedValue(['session=impersonated; Path=/']);
    const res = makeRes();

    const result = await controller.impersonate(req, res, 'u1');

    expect(command.mock.calls[0][0]).toBeInstanceOf(ImpersonateUserCommand);
    expect(command.mock.calls[0][0].userId).toBe('u1');
    expect(res.setHeader).toHaveBeenCalledWith('set-cookie', ['session=impersonated; Path=/']);
    // The user is read back with a query; the command answers only the cookies.
    expect(query.mock.calls[0][0]).toBeInstanceOf(GetUserQuery);
    expect(result).toBe(user);
  });

  it('does not set a cookie header when Better Auth returns none', async () => {
    command.mockResolvedValue([]);
    const res = makeRes();

    await controller.impersonate(req, res, 'u1');

    expect(res.setHeader).not.toHaveBeenCalled();
  });
});
