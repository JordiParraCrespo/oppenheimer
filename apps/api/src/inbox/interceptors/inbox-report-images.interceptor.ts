import {
  BadRequestException,
  type CallHandler,
  type ExecutionContext,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AppError } from '@oppenheimer/backend-core';
import { INBOX_REPORT_IMAGE_MAX_BYTES, INBOX_REPORT_IMAGES_MAX } from '@oppenheimer/shared';
import { memoryStorage } from 'multer';
import type { Observable } from 'rxjs';
import { InboxErrors } from '../domain/inbox.errors';

/** Multer's message for a part past `limits.files`, which Nest passes on as a bare 400. */
const TOO_MANY_FILES = 'Too many files';

const Base = FilesInterceptor('images', undefined, {
  storage: memoryStorage(),
  limits: { fileSize: INBOX_REPORT_IMAGE_MAX_BYTES, files: INBOX_REPORT_IMAGES_MAX },
});

/**
 * A report's pictures: the `images` field, none to `INBOX_REPORT_IMAGES_MAX`
 * of them, each capped by multer before it is buffered. Multer's two
 * refusals arrive with no `code`; they are folded onto the Inbox's catalog
 * here, as `FileUploadInterceptor` does for a single file. A report with no
 * picture is a report, so a missing part is no error.
 */
@Injectable()
export class InboxReportImagesInterceptor extends Base {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    try {
      return (await super.intercept(context, next)) as Observable<unknown>;
    } catch (error) {
      if (isTooLarge(error)) {
        throw new AppError(InboxErrors.REPORT_IMAGE_TOO_LARGE, {
          detail: `A picture is over the ${INBOX_REPORT_IMAGE_MAX_BYTES} byte limit.`,
          extensions: { maxBytes: INBOX_REPORT_IMAGE_MAX_BYTES },
          cause: error,
        });
      }
      if (isTooMany(error)) {
        throw new AppError(InboxErrors.TOO_MANY_REPORT_IMAGES, {
          detail: `A report carries at most ${INBOX_REPORT_IMAGES_MAX} pictures.`,
          extensions: { maxImages: INBOX_REPORT_IMAGES_MAX },
          cause: error,
        });
      }
      throw error;
    }
  }
}

function isTooLarge(error: unknown): boolean {
  if (error instanceof PayloadTooLargeException) return true;
  return (error as { code?: unknown } | null)?.code === 'LIMIT_FILE_SIZE';
}

function isTooMany(error: unknown): boolean {
  if (error instanceof BadRequestException) return error.message.startsWith(TOO_MANY_FILES);
  return (error as { code?: unknown } | null)?.code === 'LIMIT_FILE_COUNT';
}
