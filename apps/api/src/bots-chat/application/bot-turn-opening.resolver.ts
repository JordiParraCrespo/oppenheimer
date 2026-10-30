import { Inject, Injectable } from '@nestjs/common';
import type { BotTurnImage } from '@oppenheimer/backend-agents';
import { AppError } from '@oppenheimer/backend-core';
import { BotErrors } from '../../bots/domain/bots.errors';
import { BotAttachmentMapper } from '../bot-attachment.mapper';
import {
  BOT_ATTACHMENT_FILES,
  BOT_ATTACHMENT_REPOSITORY,
  BOT_MESSAGE_REPOSITORY,
} from '../bots-chat.di-tokens';
import type { BotAttachmentRepositoryPort } from '../database/bot-attachment.repository.port';
import type { BotMessageRepositoryPort } from '../database/bot-message.repository.port';
import { attachedImagesNote } from '../domain/bot-image.policy';
import { botTurnPrompt } from '../domain/bot-prompt.policy';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import type { BotAttachmentFilesPort } from '../infrastructure/bot-attachment-files.port';

/** What a turn is asked: the words, and the images that came with them. */
export interface BotTurnOpening {
  prompt: string;
  images: BotTurnImage[];
}

/**
 * The message that opened a turn, as the engine is sent it (`25-bots.md`
 * §3.1): `botTurnPrompt`'s words, and the images your message carried, read
 * from storage in the order you attached them. Only this turn's images are
 * sent; earlier ones stay in the chat, and the history says they were there.
 * An image that cannot be read fails the turn rather than answering without it.
 */
@Injectable()
export class BotTurnOpeningResolver {
  constructor(
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    @Inject(BOT_ATTACHMENT_REPOSITORY) private readonly attachments: BotAttachmentRepositoryPort,
    @Inject(BOT_ATTACHMENT_FILES) private readonly files: BotAttachmentFilesPort,
    private readonly mapper: BotAttachmentMapper,
  ) {}

  async resolve(turn: BotTurnEntity): Promise<BotTurnOpening> {
    const opening = await this.messages.findOpening(turn.organizationId, turn.id);
    if (!opening?.attachments.length) return { prompt: botTurnPrompt(opening), images: [] };
    const prompt = [botTurnPrompt(opening).trim(), attachedImagesNote(opening.attachments)]
      .filter(Boolean)
      .join('\n\n');
    const stored = await this.attachments.findForMessage(turn.organizationId, opening.id);
    const images = await Promise.all(
      opening.attachments.map(async ({ id }) => {
        const attachment = stored.find((candidate) => candidate.id === id);
        const data = attachment
          ? await this.files.read(attachment.storageKey).catch(() => null)
          : null;
        if (!attachment || !data) {
          throw new AppError(BotErrors.ATTACHMENT_NOT_FOUND, {
            detail: `An image the message carries (${id}) could not be read`,
          });
        }
        return this.mapper.toTurnImage(attachment, data);
      }),
    );
    return { prompt, images };
  }
}
