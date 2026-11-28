import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod/v4';
import { BotAttachmentMapper } from '../bot-attachment.mapper';
import { BOT_ATTACHMENT_FILES, BOT_ATTACHMENT_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotAttachmentRepositoryPort } from '../database/bot-attachment.repository.port';
import { VIEWED_IMAGES_PER_TURN, viewableImage } from '../domain/bot-image-view.policy';
import { promptText } from '../domain/bot-prompt-text.policy';
import type { BotAttachmentFilesPort } from '../infrastructure/bot-attachment-files.port';
import {
  type BotToolArea,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

/**
 * `view_image`: a turn is sent only its own message's images, and each
 * earlier one is a note with its id (`imagesNote`); this loads one again and
 * hands it to the model as the call's image, for the model alone, as a
 * screenshot is (`modelImages`): nothing is stored again and the chat shows
 * nothing new. Only an image a message of this conversation carries, of this
 * bot and workspace, matched by id; any other id is not found, so an id from
 * another conversation, another bot or an unsent upload reads as none.
 * Read-only: it reaches nothing outside the chat and never asks first.
 */
@Injectable()
export class BotImageToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists it: it reads only the bot's own chat. */
  readonly group = 'self' as const;

  constructor(
    @Inject(BOT_ATTACHMENT_REPOSITORY) private readonly images: BotAttachmentRepositoryPort,
    @Inject(BOT_ATTACHMENT_FILES) private readonly files: BotAttachmentFilesPort,
    private readonly mapper: BotAttachmentMapper,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [
      defineBotTool({
        name: 'view_image',
        readOnly: true,
        scope: 'bots:read',
        description: promptText('core/tools-images.view-image', {
          viewsPerTurn: String(VIEWED_IMAGES_PER_TURN),
        }),
        input: z.strictObject({
          image_id: z.string().uuid().describe(promptText('core/tools-images.view-image-id')),
        }),
        run: async (input, context) => {
          if (!context.seesImages)
            throw new BotToolRefusal(promptText('core/tools-images.needs-eyes'));
          const found = await this.images.findInConversation(
            context.organizationId,
            context.botId,
            context.conversationId,
            input.image_id,
          );
          if (found.isNone()) {
            throw new BotToolRefusal(
              promptText('core/tools-images.not-found', { id: input.image_id }),
            );
          }
          const image = found.unwrap();
          if (!viewableImage(image)) {
            throw new BotToolRefusal(
              promptText('core/tools-images.unreadable', { name: image.name }),
            );
          }
          // Spent only on an image that is there, so a wrong id costs no look.
          if (!context.budget.take('view_image', VIEWED_IMAGES_PER_TURN)) {
            throw new BotToolRefusal(
              promptText('core/tools-images.views-spent', {
                viewsPerTurn: String(VIEWED_IMAGES_PER_TURN),
              }),
            );
          }
          const data = await this.files.read(image.storageKey).catch(() => null);
          if (!data)
            throw new BotToolRefusal(promptText('core/tools-images.gone', { name: image.name }));
          if (!viewableImage({ mimeType: image.mimeType, sizeBytes: data.length })) {
            throw new BotToolRefusal(
              promptText('core/tools-images.unreadable', { name: image.name }),
            );
          }
          return {
            content: promptText('core/tools-images.viewed', { name: image.name }),
            modelImages: [this.mapper.toTurnImage(image, data)],
          };
        },
      }),
    ];
  }
}
