import { randomUUID } from 'node:crypto';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { SessionAttachmentDto } from '@oppenheimer/shared';
import { sniffSessionImage } from '@oppenheimer/shared/protocol';
import { SessionErrors } from '../../domain/sessions.errors';
import type { SessionAttachmentStorePort } from '../../infrastructure/session-attachment-store.port';
import { SESSION_ATTACHMENTS } from '../../sessions.di-tokens';
import { UploadSessionAttachmentCommand } from './upload-session-attachment.command';

/**
 * Keeps an image for a first task until the create that names it.
 *
 * The bytes are judged here, by their magic bytes and never the browser's
 * label, so a create names only images a host will take. What is kept belongs
 * to the uploader in their workspace; nobody else's create can name it.
 */
@CommandHandler(UploadSessionAttachmentCommand)
export class UploadSessionAttachmentCommandHandler
  implements ICommandHandler<UploadSessionAttachmentCommand, SessionAttachmentDto>
{
  constructor(
    @Inject(SESSION_ATTACHMENTS)
    private readonly store: SessionAttachmentStorePort,
  ) {}

  async execute(command: UploadSessionAttachmentCommand): Promise<SessionAttachmentDto> {
    if (!command.organizationId) throw new AppError(SessionErrors.NO_ACTIVE_ORGANIZATION);
    const mediaType = sniffSessionImage(command.data);
    if (!mediaType) {
      throw new AppError(SessionErrors.UNSUPPORTED_IMAGE, {
        detail: 'The file is not one of the image types a session takes.',
      });
    }
    const id = randomUUID();
    await this.store.put({
      id,
      organizationId: command.organizationId,
      userId: command.userId,
      mediaType,
      data: command.data,
    });
    return { id, mediaType, size: command.data.length };
  }
}
