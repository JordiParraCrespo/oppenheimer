import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { ScopeContext, ScopedRequest } from '../scope-context';

/**
 * Injects the request's {@link ScopeContext}, or `null` when the caller is a
 * browser session rather than a scoped credential. Handlers use it to tailor
 * responses (for example, to show which token performed an action).
 */
export const CurrentScope = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ScopeContext | null => {
    const request = ctx.switchToHttp().getRequest<ScopedRequest>();
    return request.scopeContext ?? null;
  },
);
