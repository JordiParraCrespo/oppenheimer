import type { CommandBus } from '@nestjs/cqrs';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUserResponseDto } from '../../../dtos/admin-user.response.dto';
import { ImpersonateUserCommand } from '../impersonate-user.command';
import { ImpersonateUserHttpController } from '../impersonate-user.http.controller';

const user = { id: 'u1', email: 'a@b.com' } as AdminUserResponseDto;
const req = { headers: { cookie: 'session=abc' } } as unknown as Request;

function makeRes(): Response & { setHeader: ReturnType<typeof vi.fn> } {
  return { setHeader: vi.fn() } as unknown as Response & { setHeader: ReturnType<typeof vi.fn> };
}

describe('ImpersonateUserHttpController', () => {
  const execute = vi.fn();
  let controller: ImpersonateUserHttpController;

  beforeEach(() => {
    execute.mockReset();
    controller = new ImpersonateUserHttpController({ execute } as unknown as CommandBus);
  });

  it('forwards the impersonation cookie to the response', async () => {
    execute.mockResolvedValue({ user, cookies: ['session=impersonated; Path=/'] });
    const res = makeRes();

    const result = await controller.impersonate(req, res, 'u1');

    expect(result).toBe(user);
    const command = execute.mock.calls[0][0] as ImpersonateUserCommand;
    expect(command).toBeInstanceOf(ImpersonateUserCommand);
    expect(command.userId).toBe('u1');
    expect(res.setHeader).toHaveBeenCalledWith('set-cookie', ['session=impersonated; Path=/']);
  });

  it('does not set a cookie header when Better Auth returns none', async () => {
    execute.mockResolvedValue({ user, cookies: [] });
    const res = makeRes();

    await controller.impersonate(req, res, 'u1');

    expect(res.setHeader).not.toHaveBeenCalled();
  });
});
