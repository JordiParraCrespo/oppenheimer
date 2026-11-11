import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireOrganization } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import {
  INBOX_REPORT_IMAGE_MAX_BYTES,
  INBOX_REPORT_IMAGE_MIME_TYPES,
  INBOX_REPORT_IMAGES_MAX,
} from '@oppenheimer/shared';
import { SESSION_FILE_TYPES, sniffSessionFile } from '@oppenheimer/shared/protocol';
import type { InboxReportRepositoryPort } from '../../database/inbox-report.repository.port';
import { InboxErrors } from '../../domain/inbox.errors';
import { InboxReportEntity, type PostedInboxReportImage } from '../../domain/inbox-report.entity';
import { isInboxReportImageMimeType } from '../../domain/inbox-report.policy';
import { INBOX_REPORT_FILES, INBOX_REPORT_REPOSITORY } from '../../inbox.di-tokens';
import type { InboxReportFilesPort } from '../../infrastructure/inbox-report-files.port';
import { type PostedInboxReportFile, PostInboxReportCommand } from './post-inbox-report.command';

/**
 * An agent sends a report to the workspace's Inbox
 * (`product/versions/mvp/29-inbox.md`, "Reports"). Every picture is judged
 * before any is stored, and by its bytes, never by the type it was sent as,
 * through the table a session's files are judged by. The files are written
 * first, so a report never names a picture that is not there; when the row
 * cannot be written they are deleted again.
 */
@CommandHandler(PostInboxReportCommand)
export class PostInboxReportCommandHandler
  implements ICommandHandler<PostInboxReportCommand, string>
{
  constructor(
    @Inject(INBOX_REPORT_REPOSITORY) private readonly reports: InboxReportRepositoryPort,
    @Inject(INBOX_REPORT_FILES) private readonly files: InboxReportFilesPort,
  ) {}

  async execute(command: PostInboxReportCommand): Promise<string> {
    const { organizationId, userId, title, body, source, link, images } = command;
    requireOrganization(organizationId);
    if (images.length > INBOX_REPORT_IMAGES_MAX) {
      throw new AppError(InboxErrors.TOO_MANY_REPORT_IMAGES, {
        detail: `${images.length} pictures; a report carries at most ${INBOX_REPORT_IMAGES_MAX}.`,
        extensions: { maxImages: INBOX_REPORT_IMAGES_MAX },
      });
    }
    const report = InboxReportEntity.post({
      organizationId,
      createdByUserId: userId,
      title,
      body,
      source,
      link,
      images: images.map((image) => this.judge(image)),
    });
    const stored: string[] = [];
    try {
      for (const [index, image] of report.images.entries()) {
        await this.files.store(image.storageKey, images[index].data, image.mimeType);
        stored.push(image.storageKey);
      }
      await this.reports.insert(report);
    } catch (error) {
      await Promise.all(stored.map((key) => this.files.remove(key).catch(() => undefined)));
      throw error;
    }
    return report.id;
  }

  private judge({ data, name }: PostedInboxReportFile): PostedInboxReportImage {
    if (data.length > INBOX_REPORT_IMAGE_MAX_BYTES) {
      throw new AppError(InboxErrors.REPORT_IMAGE_TOO_LARGE, {
        detail: `${name || 'A picture'} is ${data.length} bytes; the limit is ${INBOX_REPORT_IMAGE_MAX_BYTES}.`,
        extensions: { maxBytes: INBOX_REPORT_IMAGE_MAX_BYTES },
      });
    }
    const mimeType = sniffSessionFile(data);
    if (!mimeType || !isInboxReportImageMimeType(mimeType)) {
      throw new AppError(InboxErrors.REPORT_IMAGE_TYPE_UNSUPPORTED, {
        detail: `Use one of: ${INBOX_REPORT_IMAGE_MIME_TYPES.join(', ')}.`,
        extensions: { acceptedMimeTypes: [...INBOX_REPORT_IMAGE_MIME_TYPES] },
      });
    }
    const extension = SESSION_FILE_TYPES.find((type) => type.mediaType === mimeType)?.extension;
    return { mimeType, sizeBytes: data.length, name, extension: (extension ?? '.bin').slice(1) };
  }
}
