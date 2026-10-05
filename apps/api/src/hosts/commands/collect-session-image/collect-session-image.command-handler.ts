import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { ParkedFile, ParkedFilePort } from '../../../links/application/parked-file.port';
import { PARKED_FILES } from '../../../links/links.di-tokens';
import { HostErrors } from '../../domain/hosts.errors';
import { CollectSessionImageCommand } from './collect-session-image.command';

/**
 * A runner collecting the image a `session.image` named. It is a command, not
 * a query: collecting it is what removes it, so an image leaves the control
 * plane exactly once, and only for the host it was parked for.
 */
@CommandHandler(CollectSessionImageCommand)
export class CollectSessionImageCommandHandler
  implements ICommandHandler<CollectSessionImageCommand, ParkedFile>
{
  constructor(
    @Inject(PARKED_FILES)
    private readonly files: ParkedFilePort,
  ) {}

  async execute(command: CollectSessionImageCommand): Promise<ParkedFile> {
    const image = await this.files.collect(command.commandId, command.hostId);
    if (!image) throw new AppError(HostErrors.FILE_NOT_PARKED);
    return image;
  }
}
