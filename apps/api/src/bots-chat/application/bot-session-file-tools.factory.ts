import { Inject, Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { BotAttachment } from '@oppenheimer/shared';
import { z } from 'zod/v4';
import {
  FindSessionSharedPreviewQuery,
  type SessionSharedPreviewRead,
} from '../../sessions/queries/find-session-shared-preview/find-session-shared-preview.query';
import { BOT_ATTACHMENT_FILES, BOT_ATTACHMENT_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotAttachmentRepositoryPort } from '../database/bot-attachment.repository.port';
import { BotAttachmentEntity } from '../domain/bot-attachment.entity';
import { promptText } from '../domain/bot-prompt-text.policy';
import { isShowableSharedFile } from '../domain/bot-shared-file.policy';
import { SHOWN_IMAGES_PER_TURN } from '../domain/bot-shown-image.policy';
import { cut, RUNNER_TOO_OLD_ADVICE } from '../domain/bot-tool-text.policy';
import type { BotAttachmentFilesPort } from '../infrastructure/bot-attachment-files.port';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  defineBotTool,
} from './bot-tool.factory';

/**
 * A file a session's agent shared, shown to the person under the bot's reply:
 * `show_session_file`. The bytes live on the host, so the sessions module asks
 * the runner for the JPEG preview it kept when the file was shared, and the
 * preview is stored as the chat's own image, as `show_image` stores one from
 * the web, and counts against the same images per turn. Only an image with a
 * preview can be shown; for any other file the tool says so, and the file stays
 * on the host.
 */
@Injectable()
export class BotSessionFileToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'sessions' as const;

  constructor(
    private readonly queryBus: QueryBus,
    @Inject(BOT_ATTACHMENT_REPOSITORY) private readonly attachments: BotAttachmentRepositoryPort,
    @Inject(BOT_ATTACHMENT_FILES) private readonly files: BotAttachmentFilesPort,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [
      defineBotTool({
        name: 'show_session_file',
        scope: 'sessions:read',
        description: promptText('tools/session-file.show-session-file', {
          shownImagesPerTurn: String(SHOWN_IMAGES_PER_TURN),
        }),
        input: z.object({
          session_id: z
            .uuid()
            .describe(promptText('tools/session-file.show-session-file-session-id')),
          file_id: z
            .string()
            .min(1)
            .max(64)
            .describe(promptText('tools/session-file.show-session-file-file-id')),
        }),
        run: async (input, context) => {
          const read = await this.queryBus.execute<
            FindSessionSharedPreviewQuery,
            SessionSharedPreviewRead
          >(
            new FindSessionSharedPreviewQuery({
              scope: context.owner,
              sessionId: input.session_id,
              fileId: input.file_id,
            }),
          );
          if (read.kind !== 'preview') return refusalOf(read, input.file_id);
          if (!isShowableSharedFile(read.file))
            return refusalOf({ kind: 'no_preview', file: read.file }, input.file_id);
          if (!context.budget.take('show_image', SHOWN_IMAGES_PER_TURN)) {
            return promptText('tools/session-file.show-session-file-refused-turn-has', {
              shownImagesPerTurn: String(SHOWN_IMAGES_PER_TURN),
            });
          }
          const shown = await this.store(Buffer.from(read.data, 'base64'), read.file.name, context);
          return {
            content: promptText('tools/session-file.show-session-file-content', {
              name: shown.name,
              name2: read.file.name,
            }),
            images: [shown],
          };
        },
      }),
    ];
  }

  /** The preview kept as the chat's own image, named for the file the agent shared. */
  private async store(
    bytes: Buffer,
    name: string,
    context: BotToolCallContext,
  ): Promise<BotAttachment> {
    const attachment = BotAttachmentEntity.upload(
      {
        organizationId: context.organizationId,
        botId: context.botId,
        uploadedByUserId: null,
        mimeType: 'image/jpeg',
        sizeBytes: bytes.length,
        name: cut(name, 200),
      },
      'jpg',
    );
    await this.files.store(attachment.storageKey, bytes, 'image/jpeg');
    try {
      await this.attachments.insert(attachment);
    } catch (error) {
      await this.files.remove(attachment.storageKey).catch(() => undefined);
      throw error;
    }
    return attachment.toMessageAttachment();
  }
}

/** Why nothing was shown, in words the model passes on or acts on. */
function refusalOf(read: Exclude<SessionSharedPreviewRead, { kind: 'preview' }>, fileId: string) {
  switch (read.kind) {
    case 'unknown_file':
      return promptText('tools/session-file.refusal-of-refused-session-lists', { fileId });
    case 'no_preview':
      return promptText('tools/session-file.refusal-of-refused-image-host', {
        name: read.file.name,
        mediaType: read.file.mediaType,
      });
    case 'host_offline':
      return promptText('tools/session-file.refusal-of-shown-sessions-host', {
        name: read.file.name,
      });
    case 'not_supported':
      return promptText('tools/session-file.not-shown-runner-too-old', {
        runnerTooOldAdvice: RUNNER_TOO_OLD_ADVICE,
      });
    case 'timed_out':
      return promptText('tools/session-file.not-shown-timed-out', {
        name: read.file.name,
      });
    case 'gone':
      return promptText('tools/session-file.refusal-of-shown-host-longer', {
        name: read.file.name,
        code: read.code,
      });
  }
}
