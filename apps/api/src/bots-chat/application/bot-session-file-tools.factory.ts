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
import { isShowableSharedFile } from '../domain/bot-shared-file.policy';
import { SHOWN_IMAGES_PER_TURN } from '../domain/bot-shown-image.policy';
import { cut } from '../domain/bot-tool-text.policy';
import type { BotAttachmentFilesPort } from '../infrastructure/bot-attachment-files.port';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  defineBotTool,
} from './bot-tool.factory';

/**
 * A file a session's agent shared, shown to the person under the bot's reply
 * (`product/next-steps/agent-tools.md` §7): `show_session_file`. The bytes
 * live on the host, so the sessions module asks the runner for the JPEG
 * preview it kept when the file was shared, and the preview is stored as the
 * chat's own image, as `show_image` stores one from the web, and counts
 * against the same images per turn. Only an image with a preview can be
 * shown; for any other file the tool says so, and the file stays on the host.
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
        description: `Shows the person an image a session's agent shared (runner sessions send-file), under your reply, as a picture they can open: a screenshot of what it built, a chart it drew. get_session lists the files a session's agent shared, with their ids; only an image the host kept a preview of can be shown (a JPEG of at most 1600 px), and the session's host must be online. Counts against the ${SHOWN_IMAGES_PER_TURN} images a turn may show. You do not see the image; say in your reply what it is.`,
        input: z.object({
          session_id: z.uuid().describe('The session (from list_sessions).'),
          file_id: z.string().min(1).max(64).describe("The file's id, from get_session."),
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
            return `Refused: this turn has already shown ${SHOWN_IMAGES_PER_TURN} images, the limit.`;
          }
          const shown = await this.store(Buffer.from(read.data, 'base64'), read.file.name, context);
          return {
            content: `Shown to the person under your reply as "${shown.name}" (a preview of ${read.file.name}).`,
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
      return `Refused: the session lists no shared file ${fileId}. get_session lists the files its agent shared (the last 20).`;
    case 'no_preview':
      return `Refused: ${read.file.name} (${read.file.mediaType}) is not an image the host kept a preview of, so it cannot be shown. A text file's words are not shown here either; tell the person it is on the host, or read what the agent said about it with read_session.`;
    case 'host_offline':
      return `Not shown: the session's host is offline, and ${read.file.name} is only on it. Try again when it is back.`;
    case 'not_supported':
      return `Not shown: the session's host runs a runner too old to send a shared file's preview. update_host_runner updates it; then try again.`;
    case 'timed_out':
      return `Not shown: the session's host did not send ${read.file.name} in time. Try again.`;
    case 'gone':
      return `Not shown: the host no longer has ${read.file.name} (${read.code}).`;
  }
}
