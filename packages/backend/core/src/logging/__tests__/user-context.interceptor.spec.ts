import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';
import { describe, expect, it, vi } from 'vitest';
import { UserContextInterceptor } from '../user-context.interceptor';

function httpContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const next: CallHandler = { handle: vi.fn() };

function intercept(request: Record<string, unknown>, assign = vi.fn()) {
  const logger = { assign } as unknown as PinoLogger;
  new UserContextInterceptor(logger).intercept(httpContext(request), next);
  return assign;
}

describe('UserContextInterceptor', () => {
  it('assigns the user id once a guard has resolved the session', () => {
    const assign = intercept({ user: { id: 'user-1' } });

    expect(assign).toHaveBeenCalledWith({ userId: 'user-1' });
  });

  it('includes the effective scopes of a scoped credential', () => {
    const assign = intercept({
      user: { id: 'user-1' },
      scopeContext: { scopes: ['users:read', 'users:write'] },
    });

    expect(assign).toHaveBeenCalledWith({
      userId: 'user-1',
      scopes: ['users:read', 'users:write'],
    });
  });

  it('assigns nothing for unauthenticated requests', () => {
    expect(intercept({})).not.toHaveBeenCalled();
    expect(intercept({ user: null })).not.toHaveBeenCalled();
  });

  it('skips non-http executions', () => {
    const assign = vi.fn();
    const logger = { assign } as unknown as PinoLogger;
    const context = { getType: () => 'ws' } as unknown as ExecutionContext;

    new UserContextInterceptor(logger).intercept(context, next);

    expect(assign).not.toHaveBeenCalled();
  });

  it('tolerates routes outside the request-logger scope', () => {
    const assign = vi.fn(() => {
      throw new Error('unable to assign extra fields out of request scope');
    });

    expect(() => intercept({ user: { id: 'user-1' } }, assign)).not.toThrow();
  });
});
