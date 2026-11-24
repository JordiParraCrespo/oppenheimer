import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { SeeWhatsappImageCommand } from '../../whatsapp/commands/see-whatsapp-image/see-whatsapp-image.command';
import {
  type WhatsappImageSight,
  whatsappUnseenImageText,
} from '../../whatsapp/domain/whatsapp-image.policy';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import { WHATSAPP_IMAGE_OPENING, whatsappMessageOf } from '../domain/bot-whatsapp-turn.policy';
import type {
  BotOpeningMediaReaderPort,
  BotOpeningMediaReading,
} from './bot-opening-media-reader.port';

/**
 * A WhatsApp image, fetched when its turn starts: the whatsapp module asks
 * the host for it, and the turn is sent it as an image of the message, which
 * the chat keeps from then on. The message keeps its caption; an uncaptioned
 * image's `[image]` goes, since the image itself is there. When it cannot be
 * fetched, the message says why instead, so the bot can tell the person.
 * The image is the message the turn's key names.
 */
@Injectable()
export class BotWhatsappImageResolver implements BotOpeningMediaReaderPort {
  readonly kind = 'whatsapp_image';

  constructor(private readonly commands: CommandBus) {}

  async read(turn: BotTurnEntity, opening: BotMessageEntity): Promise<BotOpeningMediaReading> {
    const source = whatsappMessageOf(turn.sourceKey);
    const sight: WhatsappImageSight = source
      ? await this.commands.execute<SeeWhatsappImageCommand, WhatsappImageSight>(
          new SeeWhatsappImageCommand({
            organizationId: turn.organizationId,
            accountId: source.whatsappAccountId,
            messageRowId: source.messageRowId,
          }),
        )
      : { seen: false, reason: 'it is no longer kept' };
    const caption = opening.content === WHATSAPP_IMAGE_OPENING ? '' : opening.content;
    if (!sight.seen) {
      return {
        words: [caption, whatsappUnseenImageText(sight.reason)].filter(Boolean).join('\n\n'),
      };
    }
    const { mimeType } = sight;
    const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.slice('image/'.length);
    return {
      words: caption,
      images: [{ data: sight.data, mimeType, name: `whatsapp-image.${extension}` }],
    };
  }
}
