import type { CommandBus } from '@nestjs/cqrs';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { AdminUserResponseDto } from '../../../dtos/admin-user.response.dto';
import { StopImpersonatingHttpController } from '../stop-impersonating.http.controller';

describe('StopImpersonatingHttpController', () => {
  it('forwards the restored session cookie to the response', async () => {
    const user = { id: 'admin' } as AdminUserResponseDto;
    const execute = vi.fn().mockResolvedValue({ user, cookies: ['session=admin; Path=/'] });
    const controller = new StopImpersonatingHttpController({ execute } as unknown as CommandBus);
    const res = { setHeader: vi.fn() };

    const result = await controller.stopImpersonating(
      { headers: {} } as Request,
      res as unknown as Response,
    );

    expect(result).toBe(user);
    expect(res.setHeader).toHaveBeenCalledWith('set-cookie', ['session=admin; Path=/']);
  });
});
