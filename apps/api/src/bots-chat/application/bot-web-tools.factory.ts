import { Inject, Injectable } from '@nestjs/common';
import {
  BOT_IMAGE_MAX_BYTES,
  BOT_MESSAGE_IMAGES_MAX,
  type BotAttachment,
} from '@oppenheimer/shared';
import { SESSION_FILE_TYPES, sniffSessionFile } from '@oppenheimer/shared/protocol';
import { z } from 'zod/v4';
import { BOT_ATTACHMENT_FILES, BOT_ATTACHMENT_REPOSITORY, WEB_PAGE } from '../bots-chat.di-tokens';
import type { BotAttachmentRepositoryPort } from '../database/bot-attachment.repository.port';
import { BotAttachmentEntity, isBotImageMimeType } from '../domain/bot-attachment.entity';
import { promptText } from '../domain/bot-prompt-text.policy';
import { SHOWN_IMAGES_PER_TURN, shownImageName } from '../domain/bot-shown-image.policy';
import { fenceUntrusted, startOf } from '../domain/bot-tool-text.policy';
import type { BotAttachmentFilesPort } from '../infrastructure/bot-attachment-files.port';
import type { WebPagePort } from '../infrastructure/web-page.port';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  defineBotTool,
} from './bot-tool.factory';

/** Pages one turn may fetch. */
export const WEB_FETCHES_PER_TURN = 10;
/** The most of a page's text the model is handed. */
const PAGE_TEXT_MAX = 20_000;

/** One image `show_image` is asked to show. */
const shownImageInput = z.object({
  url: z.url().max(2_000).describe(promptText('tools/web.shown-image-url')),
  caption: z.string().max(200).optional().describe(promptText('tools/web.shown-image-caption')),
});

/**
 * Work and the web: `web_fetch`, ours rather than the engine's, reaching public
 * addresses only (`GuardedWebPageAdapter`), and `show_image`, which fetches
 * images the same way and shows them to the person under the reply. A page is
 * data: it comes back fenced, and the prompt says fenced text never authorises
 * anything.
 */
@Injectable()
export class BotWebToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'web' as const;

  constructor(
    @Inject(WEB_PAGE) private readonly web: WebPagePort,
    @Inject(BOT_ATTACHMENT_REPOSITORY) private readonly attachments: BotAttachmentRepositoryPort,
    @Inject(BOT_ATTACHMENT_FILES) private readonly files: BotAttachmentFilesPort,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [
      defineBotTool({
        name: 'web_fetch',
        readOnly: true,
        scope: 'bots:write',
        description: promptText('tools/web.web-fetch', {
          webFetchesPerTurn: String(WEB_FETCHES_PER_TURN),
        }),
        input: z.object({
          url: z.url().max(2_000).describe(promptText('tools/web.web-fetch-url')),
        }),
        run: async (input, context, signal) => {
          if (!context.budget.take('web_fetch', WEB_FETCHES_PER_TURN)) {
            return promptText('tools/web.web-fetch-refused-turn-has', {
              webFetchesPerTurn: String(WEB_FETCHES_PER_TURN),
            });
          }
          const result = await this.web.fetch(input.url, signal);
          if (result.kind !== 'page') {
            return `${result.kind === 'refused' ? 'Refused' : 'Failed'}: ${result.reason}`;
          }
          const { page } = result;
          const cut = page.text.length > PAGE_TEXT_MAX || page.truncated;
          const text = startOf(page.text, PAGE_TEXT_MAX);
          return [
            `Fetched ${page.url} (status ${page.status}, ${page.contentType})${page.title ? `: "${page.title}"` : ''}.`,
            promptText('tools/web.web-fetch-page-below-data'),
            fenceUntrusted('web_page', text),
            cut ? promptText('tools/web.web-fetch-page-longer-only') : '',
          ]
            .filter(Boolean)
            .join('\n');
        },
      }),
      defineBotTool({
        name: 'show_image',
        scope: 'bots:write',
        description: promptText('tools/web.show-image', {
          imageMaxBytes: String(BOT_IMAGE_MAX_BYTES / 1024 / 1024),
          messageImagesMax: String(BOT_MESSAGE_IMAGES_MAX),
          shownImagesPerTurn: String(SHOWN_IMAGES_PER_TURN),
        }),
        input: z.object({
          images: z.array(shownImageInput).min(1).max(BOT_MESSAGE_IMAGES_MAX),
        }),
        run: async (input, context, signal) => {
          const shown: BotAttachment[] = [];
          const lines: string[] = [];
          for (const image of input.images) {
            if (!context.budget.take('show_image', SHOWN_IMAGES_PER_TURN)) {
              lines.push(
                promptText('tools/web.show-image-refused-turn-has', {
                  url: image.url,
                  shownImagesPerTurn: String(SHOWN_IMAGES_PER_TURN),
                }),
              );
              continue;
            }
            const outcome = await this.show(image, context, signal);
            if (typeof outcome === 'string') lines.push(`${image.url}: ${outcome}`);
            else {
              shown.push(outcome);
              lines.push(`${image.url}: shown as "${outcome.name}".`);
            }
          }
          const said =
            shown.length > 0
              ? promptText('tools/web.show-image-shown-person-under', {
                  shownCount: String(shown.length),
                  imagesCount: String(input.images.length),
                })
              : 'Nothing was shown.';
          return { content: [said, ...lines].join('\n'), images: shown };
        },
      }),
    ];
  }

  /**
   * One image fetched, known by its bytes (never by the type the server
   * named) through the table a session's files are judged by, and stored
   * as the chat's own: the attachment the reply carries, or why there is none.
   */
  private async show(
    image: z.output<typeof shownImageInput>,
    context: BotToolCallContext,
    signal: AbortSignal,
  ): Promise<BotAttachment | string> {
    const result = await this.web.fetchImage(image.url, BOT_IMAGE_MAX_BYTES, signal);
    if (result.kind !== 'image') {
      return `${result.kind === 'refused' ? 'refused' : 'failed'}, ${result.reason}`;
    }
    const { bytes } = result.image;
    const mimeType = sniffSessionFile(bytes);
    if (!mimeType || !isBotImageMimeType(mimeType)) {
      return promptText('tools/web.show');
    }
    const extension = SESSION_FILE_TYPES.find((type) => type.mediaType === mimeType)?.extension;
    const attachment = BotAttachmentEntity.upload(
      {
        organizationId: context.organizationId,
        botId: context.botId,
        uploadedByUserId: null,
        mimeType,
        sizeBytes: bytes.length,
        name: shownImageName(result.image.url, image.caption),
      },
      (extension ?? '.bin').slice(1),
    );
    await this.files.store(attachment.storageKey, bytes, mimeType);
    try {
      await this.attachments.insert(attachment);
    } catch (error) {
      await this.files.remove(attachment.storageKey).catch(() => undefined);
      throw error;
    }
    return attachment.toMessageAttachment();
  }
}
