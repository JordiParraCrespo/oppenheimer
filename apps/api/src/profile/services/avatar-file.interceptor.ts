import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  mixin,
  type NestInterceptor,
  PayloadTooLargeException,
  type Type,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppError } from '@oppenheimer/backend-core';
import { AVATAR_MAX_BYTES } from '@oppenheimer/shared';
import type { Observable } from 'rxjs';
import { ProfileErrors } from '../domain/profile.errors';

/**
 * `FileInterceptor` for the avatar field, with multer's size rejection folded
 * onto the error catalog.
 *
 * The limit has to live on multer — it is what stops a large upload being
 * buffered into memory in the first place, long before any handler sees it.
 * But multer reports the rejection as a bare `PayloadTooLargeException`, which
 * `AllExceptionsFilter` renders with no `code` and the title "Payload Too
 * Large": the documented `PROFILE_005` and its `maxBytes` extension never reach
 * the client, so nothing can tell an oversized image apart from any other 413.
 *
 * Catching it here restores the contract. The equivalent check in
 * `AvatarStorage` stays: it covers callers that never go through multer.
 */
export function AvatarFileInterceptor(fieldName = 'file'): Type<NestInterceptor> {
  const Base = FileInterceptor(fieldName, {
    limits: { fileSize: AVATAR_MAX_BYTES },
  });

  @Injectable()
  class AvatarFileMixinInterceptor extends Base {
    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
      try {
        return (await super.intercept(context, next)) as Observable<unknown>;
      } catch (error) {
        if (isTooLarge(error)) {
          throw new AppError(ProfileErrors.IMAGE_TOO_LARGE, {
            detail: `That image is over the ${AVATAR_MAX_BYTES} byte limit.`,
            extensions: { maxBytes: AVATAR_MAX_BYTES },
            cause: error,
          });
        }
        throw error;
      }
    }
  }

  return mixin(AvatarFileMixinInterceptor);
}

/**
 * Multer's own error, and the `PayloadTooLargeException` Nest converts it to,
 * are both accepted: `@nestjs/platform-express` maps `LIMIT_FILE_SIZE` before
 * rejecting, but the raw error surfaces when multer is invoked directly.
 */
function isTooLarge(error: unknown): boolean {
  if (error instanceof PayloadTooLargeException) return true;
  const code = (error as { code?: unknown } | null)?.code;
  const message = (error as { message?: unknown } | null)?.message;
  return code === 'LIMIT_FILE_SIZE' || message === 'File too large';
}
