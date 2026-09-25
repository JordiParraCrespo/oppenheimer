import { type ExecutionContext, Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import { AuthErrors } from '../domain/auth.errors';
import type { ScopedRequest } from '../domain/scope-context.types';
import { ApiAuthGuard } from './api-auth.guard';

/**
 * {@link ApiAuthGuard} for routes that serve anonymous callers too — the flags
 * a signed-out visitor sees on the login page, say.
 *
 * Only the absence of a credential is forgiven. A token that is presented and
 * turns out unknown, revoked or expired still fails with `TOKEN_003`: silently
 * downgrading a broken credential to anonymous would hand a client the
 * signed-out answer and leave it no way to learn its token is dead.
 */
@Injectable()
export class OptionalApiAuthGuard extends ApiAuthGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return await super.canActivate(context);
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== AuthErrors.UNAUTHENTICATED.code) {
        throw error;
      }
      const request = context.switchToHttp().getRequest<ScopedRequest>();
      request.user = null;
      request.session = null;
      request.scopeContext = null;
      return true;
    }
  }
}
