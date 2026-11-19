import { Inject, Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { BOT_IMAGE_MAX_BYTES } from '@oppenheimer/shared';
import { z } from 'zod/v4';
import type {
  GmailDraftPage,
  GmailLabel,
  GmailSearchPage,
  GmailThread,
} from '../../mail/infrastructure/gmail-provider.port';
import { FindMailDraftsQuery } from '../../mail/queries/find-mail-drafts/find-mail-drafts.query';
import { FindMailLabelsQuery } from '../../mail/queries/find-mail-labels/find-mail-labels.query';
import {
  type MailAttachmentRead,
  ReadMailAttachmentQuery,
} from '../../mail/queries/read-mail-attachment/read-mail-attachment.query';
import { ReadMailThreadQuery } from '../../mail/queries/read-mail-thread/read-mail-thread.query';
import { SearchMailQuery } from '../../mail/queries/search-mail/search-mail.query';
import {
  describeAccount,
  describeDraft,
  describeLabel,
  describeMessage,
  describeMessageLine,
  fenceMail,
  formatSize,
  MAIL_UNTRUSTED_NOTE,
  NO_GMAIL,
} from '../bot-mail-tool.mapper';
import { BOT_ATTACHMENT_FILES, BOT_ATTACHMENT_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotAttachmentRepositoryPort } from '../database/bot-attachment.repository.port';
import { BotAttachmentEntity } from '../domain/bot-attachment.entity';
import { promptText } from '../domain/bot-prompt-text.policy';
import { formatToolList } from '../domain/bot-tool-text.policy';
import type { BotAttachmentFilesPort } from '../infrastructure/bot-attachment-files.port';
import { BotMailAccountsResolver } from './bot-mail-accounts.resolver';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
  describeToolFailure,
} from './bot-tool.factory';

/** Results one search call asks each account for. */
export const MAIL_SEARCH_LIMIT_MAX = 25;
/** Attachments one turn may open. */
export const MAIL_ATTACHMENTS_PER_TURN = 10;

const account = z.string().trim().min(1).max(320).describe(promptText('tools/mail.account'));

/**
 * Mail, the reads: the owner's own Gmail accounts, searched in Gmail's query
 * language, threads read in full, labels, drafts, and attachments opened. Every
 * tool works only the turn's owner's accounts, and only reads: nothing is sent,
 * changed or marked read. Everything a sender wrote comes back inside
 * `<email>`, marked as data.
 */
@Injectable()
export class BotMailToolsFactory implements BotToolArea {
  readonly group = 'mail' as const;

  constructor(
    private readonly queryBus: QueryBus,
    private readonly accounts: BotMailAccountsResolver,
    @Inject(BOT_ATTACHMENT_REPOSITORY) private readonly attachments: BotAttachmentRepositoryPort,
    @Inject(BOT_ATTACHMENT_FILES) private readonly files: BotAttachmentFilesPort,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [
      this.listAccounts(),
      this.searchMail(),
      this.readThread(),
      this.listLabels(),
      this.listDrafts(),
      this.readAttachment(),
    ];
  }

  private listAccounts(): BotToolDefinition {
    return defineBotTool({
      name: 'list_gmail_accounts',
      readOnly: true,
      scope: 'mail:read',
      description: promptText('tools/mail.list-gmail-accounts'),
      input: z.object({}),
      run: async (_input, context) => {
        const connections = await this.accounts.all(context.owner);
        return formatToolList('Gmail accounts', connections.map(describeAccount), NO_GMAIL);
      },
    });
  }

  private searchMail(): BotToolDefinition {
    return defineBotTool({
      name: 'search_mail',
      readOnly: true,
      scope: 'mail:read',
      description: promptText('tools/mail.search-mail', {
        mailSearchLimitMax: String(MAIL_SEARCH_LIMIT_MAX),
      }),
      input: z.object({
        query: z
          .string()
          .trim()
          .max(500)
          .default('')
          .describe(promptText('tools/mail.search-mail-query')),
        account: account.optional(),
        limit: z.number().int().min(1).max(MAIL_SEARCH_LIMIT_MAX).default(10),
        page_token: z
          .string()
          .max(500)
          .optional()
          .describe(promptText('tools/mail.search-mail-page-token')),
        include_spam_trash: z.boolean().default(false),
      }),
      run: async (input, context) => {
        if (input.page_token && !input.account) {
          throw new BotToolRefusal(promptText('tools/mail.search-mail-page-token-goes'));
        }
        const chosen = await this.accounts.choose(context.owner, input.account);
        const sections: string[] = [];
        for (const connection of chosen) {
          try {
            const page = await this.queryBus.execute<SearchMailQuery, GmailSearchPage>(
              new SearchMailQuery({
                scope: context.owner,
                connectionId: connection.id,
                request: {
                  query: input.query,
                  maxResults: input.limit,
                  pageToken: input.page_token ?? null,
                  includeSpamTrash: input.include_spam_trash,
                },
              }),
            );
            const lines = page.messages.map((message) =>
              describeMessageLine(message, context.timeZone),
            );
            sections.push(
              [
                `${describeAccount(connection)}: ${page.messages.length} shown, about ${page.resultSizeEstimate} match.`,
                lines.length > 0 ? fenceMail(lines.join('\n')) : 'Nothing matches.',
                page.nextPageToken ? `next_page_token: ${page.nextPageToken}` : '',
              ]
                .filter(Boolean)
                .join('\n'),
            );
          } catch (error) {
            sections.push(`${describeAccount(connection)}: ${describeToolFailure(error)}`);
          }
        }
        return [MAIL_UNTRUSTED_NOTE, ...sections].join('\n\n');
      },
    });
  }

  private readThread(): BotToolDefinition {
    return defineBotTool({
      name: 'read_mail_thread',
      readOnly: true,
      scope: 'mail:read',
      description: promptText('tools/mail.read-mail-thread'),
      input: z.object({
        account,
        thread_id: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .describe(promptText('tools/mail.read-mail-thread-thread-id')),
      }),
      run: async (input, context) => {
        const connection = await this.accounts.one(context.owner, input.account);
        const thread = await this.queryBus.execute<ReadMailThreadQuery, GmailThread>(
          new ReadMailThreadQuery({
            scope: context.owner,
            connectionId: connection.id,
            threadId: input.thread_id,
          }),
        );
        const messages = thread.messages.map((message) =>
          describeMessage(message, context.timeZone),
        );
        return [
          `Thread ${thread.id} in ${describeAccount(connection)}, ${thread.messages.length} message(s). ${MAIL_UNTRUSTED_NOTE}`,
          fenceMail(messages.join('\n\n')),
        ].join('\n');
      },
    });
  }

  private listLabels(): BotToolDefinition {
    return defineBotTool({
      name: 'list_mail_labels',
      readOnly: true,
      scope: 'mail:read',
      description: promptText('tools/mail.list-mail-labels'),
      input: z.object({ account }),
      run: async (input, context) => {
        const connection = await this.accounts.one(context.owner, input.account);
        const labels = await this.queryBus.execute<FindMailLabelsQuery, GmailLabel[]>(
          new FindMailLabelsQuery({ scope: context.owner, connectionId: connection.id }),
        );
        const ordered = [...labels].sort((a, b) =>
          a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'user' ? -1 : 1,
        );
        return `${describeAccount(connection)}\n${formatToolList(
          'Labels',
          ordered.map(describeLabel),
          'The account has no labels.',
        )}`;
      },
    });
  }

  private listDrafts(): BotToolDefinition {
    return defineBotTool({
      name: 'list_mail_drafts',
      readOnly: true,
      scope: 'mail:read',
      description: promptText('tools/mail.list-mail-drafts', {
        mailSearchLimitMax: String(MAIL_SEARCH_LIMIT_MAX),
      }),
      input: z.object({
        account,
        limit: z.number().int().min(1).max(MAIL_SEARCH_LIMIT_MAX).default(10),
        page_token: z.string().max(500).optional(),
      }),
      run: async (input, context) => {
        const connection = await this.accounts.one(context.owner, input.account);
        const page = await this.queryBus.execute<FindMailDraftsQuery, GmailDraftPage>(
          new FindMailDraftsQuery({
            scope: context.owner,
            connectionId: connection.id,
            maxResults: input.limit,
            pageToken: input.page_token ?? null,
          }),
        );
        if (page.drafts.length === 0) return `${describeAccount(connection)} has no drafts.`;
        return [
          `${describeAccount(connection)}: ${page.drafts.length} draft(s). ${MAIL_UNTRUSTED_NOTE}`,
          fenceMail(page.drafts.map((draft) => describeDraft(draft, context.timeZone)).join('\n')),
          page.nextPageToken ? `next_page_token: ${page.nextPageToken}` : '',
        ]
          .filter(Boolean)
          .join('\n');
      },
    });
  }

  private readAttachment(): BotToolDefinition {
    return defineBotTool({
      name: 'read_mail_attachment',
      scope: 'mail:read',
      description: promptText('tools/mail.read-mail-attachment', {
        mailAttachmentsPerTurn: String(MAIL_ATTACHMENTS_PER_TURN),
      }),
      input: z.object({
        account,
        message_id: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .describe(promptText('tools/mail.read-mail-attachment-message-id')),
        part_id: z.string().trim().min(1).max(50).describe("The attachment's part id."),
      }),
      run: async (input, context) => {
        if (!context.budget.take('read_mail_attachment', MAIL_ATTACHMENTS_PER_TURN)) {
          return promptText('tools/mail.read-mail-attachment-refused-turn-has', {
            mailAttachmentsPerTurn: String(MAIL_ATTACHMENTS_PER_TURN),
          });
        }
        const connection = await this.accounts.one(context.owner, input.account);
        const file = await this.queryBus.execute<ReadMailAttachmentQuery, MailAttachmentRead>(
          new ReadMailAttachmentQuery({
            scope: context.owner,
            connectionId: connection.id,
            messageId: input.message_id,
            partId: input.part_id,
          }),
        );
        const named = `"${file.filename}" (${file.mimeType}, ${formatSize(file.sizeBytes)})`;
        if (file.reading.kind === 'unreadable')
          return `${named}: not opened. ${file.reading.reason}`;
        if (file.reading.kind === 'image') return this.showImage(file, context);
        return [
          `${named}, read as ${file.reading.format}. ${MAIL_UNTRUSTED_NOTE}`,
          fenceMail(file.reading.text),
          file.reading.truncated
            ? promptText('tools/mail.read-mail-attachment-file-longer-only')
            : '',
        ]
          .filter(Boolean)
          .join('\n');
      },
    });
  }

  /** An image attachment, stored as the chat's own and shown to the person under the reply. */
  private async showImage(file: MailAttachmentRead, context: BotToolCallContext) {
    if (file.reading.kind !== 'image') throw new Error('Not an image');
    if (file.bytes.length > BOT_IMAGE_MAX_BYTES) {
      return promptText('tools/mail.show-image', {
        filename: file.filename,
        formatSize: formatSize(file.bytes.length),
        formatSize2: formatSize(BOT_IMAGE_MAX_BYTES),
      });
    }
    const mimeType = file.reading.mimeType;
    const attachment = BotAttachmentEntity.upload(
      {
        organizationId: context.organizationId,
        botId: context.botId,
        uploadedByUserId: null,
        mimeType,
        sizeBytes: file.bytes.length,
        name: file.filename.slice(0, 200) || 'image',
      },
      mimeType.split('/')[1] === 'jpeg' ? 'jpg' : (mimeType.split('/')[1] ?? 'bin'),
    );
    await this.files.store(attachment.storageKey, file.bytes, mimeType);
    try {
      await this.attachments.insert(attachment);
    } catch (error) {
      await this.files.remove(attachment.storageKey).catch(() => undefined);
      throw error;
    }
    return {
      content: promptText('tools/mail.show-image-content', { filename: file.filename }),
      images: [attachment.toMessageAttachment()],
    };
  }
}
