import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { SessionShareViewer } from '../domain/session-share.entity';

/**
 * Who is opening a shared session: the signed-in account
 * `OptionalApiAuthGuard` put on the request, as a share judges it, or `null`
 * for nobody signed in. Read once here, so the two guest routes never parse
 * `request.user`.
 */
export const CurrentShareViewer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionShareViewer | null => {
    const user = ctx.switchToHttp().getRequest<{ user?: unknown }>().user;
    if (!user || typeof user !== 'object') return null;
    const { id, email, emailVerified } = user as Record<string, unknown>;
    if (typeof id !== 'string' || typeof email !== 'string') return null;
    return { userId: id, email, emailVerified: emailVerified === true };
  },
);
