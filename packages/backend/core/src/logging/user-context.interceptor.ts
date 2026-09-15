import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import type { Observable } from 'rxjs';

/**
 * Copies the authenticated subject into the request log context once the auth
 * guards have resolved it: `userId` for any authenticated request, plus the
 * effective `scopes` when the credential is scoped (API token / OAuth). Runs
 * as an interceptor because interceptors execute after every guard, which is
 * the first moment `request.user` exists.
 *
 * With `assignResponse` enabled on the logger module, the fields also land on
 * the request-completion line pino-http emits — the line that matters.
 */
@Injectable()
export class UserContextInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      const request = context.switchToHttp().getRequest<{
        user?: { id?: unknown } | null;
        scopeContext?: { scopes?: unknown } | null;
      }>();

      const userId = request.user?.id;
      if (userId !== undefined && userId !== null) {
        const scopes = request.scopeContext?.scopes;
        try {
          this.logger.assign(scopes ? { userId, scopes } : { userId });
        } catch {
          // `assign` throws outside pino-http's request scope — a route the
          // request logger was configured to skip. Nothing to attach to then.
        }
      }
    }
    return next.handle();
  }
}
