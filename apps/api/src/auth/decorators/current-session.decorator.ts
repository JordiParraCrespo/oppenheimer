import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/**
 * The Better Auth session backing this request, as `ApiAuthGuard` left it on
 * `request.session`.
 *
 * On the scoped-credential path it holds only `activeOrganizationId` and
 * `activeTeamId`, so a field such as `id` is `undefined`: an API token's
 * delegated session is minted per credential, not per device, so there is no
 * session id to report. Callers must treat absence as "not one of the user's
 * sessions" rather than assuming a value.
 */
export const CurrentSession = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (!data) return request.session;
    return request.session?.[data];
  },
);
