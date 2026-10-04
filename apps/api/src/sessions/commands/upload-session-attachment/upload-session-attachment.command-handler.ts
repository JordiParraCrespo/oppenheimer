import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { SessionAttachmentDto } from '@oppenheimer/shared';
import { sniffSessionFile } from '@oppenheimer/shared/protocol';
import type { ParkedImagePort } from '../../../links/application/parked-image.port';
import { PARKED_IMAGES } from '../../../links/links.di-tokens';
import { SessionErrors } from '../../domain/sessions.errors';
import { WorkSessionMapper } from '../../work-session.mapper';
import { UploadSessionAttachmentCommand } from './upload-session-attachment.command';

/**
 * Stages a file for a first task until the create that names it.
 *
 * The bytes are judged here, never the browser's label or the file's name
 * (`sniffSessionFile`: magic bytes, or text that is only text), so a create
 * names only files a host will take. The hint picks which text type text is
 * saved as, and nothing else. What is staged
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
    const mediaType = sniffSessionFile(command.data, command.hint);
    if (!mediaType) {
      throw new AppError(SessionErrors.UNSUPPORTED_IMAGE, {
        detail:
          'Attach an image, a PDF, or a UTF-8 text file; executables, archives, scripts, SVG and HTML are refused.',
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
