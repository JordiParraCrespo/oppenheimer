import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { SessionAttachmentDto } from '@oppenheimer/shared';
import { sniffSessionImage } from '@oppenheimer/shared/protocol';
import type { ParkedImagePort } from '../../../links/application/parked-image.port';
import { PARKED_IMAGES } from '../../../links/links.di-tokens';
import { SessionErrors } from '../../domain/sessions.errors';
import { WorkSessionMapper } from '../../work-session.mapper';
import { UploadSessionAttachmentCommand } from './upload-session-attachment.command';

/**
 * Stages an image for a first task until the create that names it.
 *
 * The bytes are judged here, by their magic bytes and never the browser's
 * label, so a create names only images a host will take. What is staged
 * belongs to the uploader in their workspace and is named by its content: the
 * same file uploaded again is the same id, so a create retried after a lost
 * response sends the body it first sent. One person may have only so many
 * waiting (`STAGED_IMAGES_PER_OWNER`).
 */
@CommandHandler(UploadSessionAttachmentCommand)
export class UploadSessionAttachmentCommandHandler
  implements ICommandHandler<UploadSessionAttachmentCommand, SessionAttachmentDto>
{
  constructor(
    @Inject(PARKED_IMAGES)
    private readonly images: ParkedImagePort,
  ) {}

  async execute(command: UploadSessionAttachmentCommand): Promise<SessionAttachmentDto> {
    if (!command.organizationId) throw new AppError(SessionErrors.NO_ACTIVE_ORGANIZATION);
    if (!command.data?.length) throw new AppError(SessionErrors.IMAGE_MISSING);
    const mediaType = sniffSessionImage(command.data);
    if (!mediaType) {
      throw new AppError(SessionErrors.UNSUPPORTED_IMAGE, {
        detail: 'The file is not one of the image types a session takes.',
      });
    }
    const id = await this.images.stage({
      organizationId: command.organizationId,
      userId: command.userId,
      mediaType,
      data: command.data,
    });
    if (!id) throw new AppError(SessionErrors.TOO_MANY_ATTACHMENTS);
    return WorkSessionMapper.toAttachmentResponse(id, mediaType, command.data);
  }
}
