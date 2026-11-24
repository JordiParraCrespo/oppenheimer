import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import {
  WHATSAPP_GROUP_GRANT_REPOSITORY,
  type WhatsappGroupGrantRepositoryPort,
} from '../../database/whatsapp-group-grant.repository.port';
import { WhatsappErrors } from '../../domain/whatsapp.errors';
import { AllowWhatsappGroupCommand } from './allow-whatsapp-group.command';

/** A number answers in at most this many groups. */
export const GROUP_GRANT_CAP = 50;

@CommandHandler(AllowWhatsappGroupCommand)
export class AllowWhatsappGroupCommandHandler
  implements ICommandHandler<AllowWhatsappGroupCommand>
{
  constructor(
    @Inject(WHATSAPP_GROUP_GRANT_REPOSITORY)
    private readonly grants: WhatsappGroupGrantRepositoryPort,
  ) {}

  async execute(command: AllowWhatsappGroupCommand): Promise<void> {
    const inserted = await this.grants.insertUnderCap(
      { accountId: command.accountId, groupJid: command.groupJid, botId: command.botId },
      GROUP_GRANT_CAP,
    );
    if (!inserted) {
      throw new AppError(WhatsappErrors.GROUP_GRANT_CAP, {
        detail: `At most ${GROUP_GRANT_CAP} groups`,
      });
    }
  }
}
