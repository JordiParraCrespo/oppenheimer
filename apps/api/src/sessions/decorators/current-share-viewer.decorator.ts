import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { ShareLinkViewer } from '../domain/session-share-link.entity';

/**
 * Who is holding a share link: the signed-in account `OptionalApiAuthGuard`
 * put on the request, as a link judges it, or `null` for nobody signed in.
 * Read once here, so the two holder routes never parse `request.user`.
 */
export const CurrentShareViewer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ShareLinkViewer | null => {
    const user = ctx.switchToHttp().getRequest<{ user?: unknown }>().user;
    if (!user || typeof user !== 'object') return null;
    const { id, email, emailVerified } = user as Record<string, unknown>;
    if (typeof id !== 'string' || typeof email !== 'string') return null;
    return { userId: id, email, emailVerified: emailVerified === true };
  },
);
