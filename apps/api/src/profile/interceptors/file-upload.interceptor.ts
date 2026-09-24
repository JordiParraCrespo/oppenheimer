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
import type { ErrorDefinition } from '@oppenheimer/backend-ddd';
import { AVATAR_MAX_BYTES } from '@oppenheimer/shared';
import { memoryStorage } from 'multer';
import type { Observable } from 'rxjs';
import { ProfileErrors } from '../domain/profile.errors';

export interface FileUploadOptions {
  /** The multipart field the file travels in. */
  field: string;
  /** The ceiling, enforced by multer before the body is buffered. */
  maxBytes: number;
  /** The catalog entry for a file over `maxBytes`; its problem carries `maxBytes`. */
  tooLarge: ErrorDefinition;
  /** The catalog entry for a request with no file part at all. */
  missing: ErrorDefinition;
}

/**
 * `FileInterceptor` for a single uploaded file, with multer's rejections
 * folded onto the caller's own catalog — the avatar and a pasted image are
 * the two routes that take one.
 *
 * The limit has to live on multer: it is what stops a large upload being
 * buffered into memory in the first place, long before any handler sees it.
 * But multer reports the rejection as a bare `PayloadTooLargeException`, which
 * `AllExceptionsFilter` renders with no `code`, so nothing could tell an
 * oversized file apart from any other 413. Catching it here restores the
 * contract. A request with no file part is the caller's `missing` code, not a
 * validation failure: `invalidParams` describes rejected *fields*, and a
 * missing part is not one.
 *
 * Storage is memory, stated here rather than assumed: the handlers read
 * `file.buffer`, and a `MulterModule` default pointing at disk would hand
 * them `undefined`.
 */
export function FileUploadInterceptor(options: FileUploadOptions): Type<NestInterceptor> {
  const Base = FileInterceptor(options.field, {
    storage: memoryStorage(),
    limits: { fileSize: options.maxBytes, files: 1 },
  });

  @Injectable()
  class FileUploadMixinInterceptor extends Base {
    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
      try {
        const result = (await super.intercept(context, next)) as Observable<unknown>;
        const file = context.switchToHttp().getRequest<{ file?: { buffer?: unknown } }>().file;
        if (!file?.buffer) {
          throw new AppError(options.missing, {
            detail: `No file was uploaded under the \`${options.field}\` field.`,
          });
        }
        return result;
      } catch (error) {
        if (isTooLarge(error)) {
          throw new AppError(options.tooLarge, {
            detail: `The file is over the ${options.maxBytes} byte limit.`,
            extensions: { maxBytes: options.maxBytes },
            cause: error,
          });
        }
        throw error;
      }
    }
  }

  return mixin(FileUploadMixinInterceptor);
}

/**
 * Multer's own error, and the `PayloadTooLargeException` Nest converts it to,
 * are both accepted: `@nestjs/platform-express` maps `LIMIT_FILE_SIZE` before
 * rejecting, but the raw error surfaces when multer is invoked directly.
 */
function isTooLarge(error: unknown): boolean {
  if (error instanceof PayloadTooLargeException) return true;
  return (error as { code?: unknown } | null)?.code === 'LIMIT_FILE_SIZE';
}

/** The avatar's upload: the `file` field, its cap, and the profile catalog's refusals. */
export const AvatarFileInterceptor = FileUploadInterceptor({
  field: 'file',
  maxBytes: AVATAR_MAX_BYTES,
  tooLarge: ProfileErrors.IMAGE_TOO_LARGE,
  missing: ProfileErrors.UNSUPPORTED_IMAGE_TYPE,
});
