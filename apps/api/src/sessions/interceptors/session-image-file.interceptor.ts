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
import { SESSION_IMAGE_MAX_BYTES } from '@oppenheimer/shared';
import type { Observable } from 'rxjs';
import { SessionErrors } from '../domain/sessions.errors';

/**
 * `FileInterceptor` for a pasted image, with multer's rejections folded onto
 * the sessions catalog — the same shape as the avatar's.
 *
 * The limit lives on multer, which is what stops an oversized upload being
 * buffered at all; multer reports it as a codeless 413, so it is caught here
 * and given `SESSIONS_011`. A request with no file part is `SESSIONS_012`.
 */
export function SessionImageFileInterceptor(fieldName = 'file'): Type<NestInterceptor> {
  const Base = FileInterceptor(fieldName, {
    limits: { fileSize: SESSION_IMAGE_MAX_BYTES, files: 1 },
  });

  @Injectable()
  class SessionImageFileMixinInterceptor extends Base {
    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
      try {
        const result = (await super.intercept(context, next)) as Observable<unknown>;
        if (!context.switchToHttp().getRequest<{ file?: unknown }>().file) {
          throw new AppError(SessionErrors.UNSUPPORTED_IMAGE, {
            detail: `No file was uploaded under the \`${fieldName}\` field.`,
          });
        }
        return result;
      } catch (error) {
        if (isTooLarge(error)) {
          throw new AppError(SessionErrors.IMAGE_TOO_LARGE, {
            detail: `That image is over the ${SESSION_IMAGE_MAX_BYTES} byte limit.`,
            extensions: { maxBytes: SESSION_IMAGE_MAX_BYTES },
            cause: error,
          });
        }
        throw error;
      }
    }
  }

  return mixin(SessionImageFileMixinInterceptor);
}

function isTooLarge(error: unknown): boolean {
  if (error instanceof PayloadTooLargeException) return true;
  const code = (error as { code?: unknown } | null)?.code;
  const message = (error as { message?: unknown } | null)?.message;
  return code === 'LIMIT_FILE_SIZE' || message === 'File too large';
}
