import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { ParkedImage, ParkedImagePort } from '../../../links/application/parked-image.port';
import { PARKED_IMAGES } from '../../../links/links.di-tokens';
import { HostErrors } from '../../domain/hosts.errors';
import { CollectSessionImageCommand } from './collect-session-image.command';

/**
 * A runner collecting the image a `session.image` named. It is a command, not
 * a query: collecting it is what removes it, so an image leaves the control
 * plane exactly once, and only for the host it was parked for.
 */
@CommandHandler(CollectSessionImageCommand)
export class CollectSessionImageCommandHandler
  implements ICommandHandler<CollectSessionImageCommand, ParkedImage>
{
  constructor(
    @Inject(PARKED_IMAGES)
    private readonly images: ParkedImagePort,
  ) {}

  async execute(command: CollectSessionImageCommand): Promise<ParkedImage> {
    const image = await this.images.collect(command.commandId, command.hostId);
    if (!image) throw new AppError(HostErrors.IMAGE_NOT_PARKED);
    return image;
  }
}
