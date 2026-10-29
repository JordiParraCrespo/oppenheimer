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

const account = z
  .string()
  .trim()
  .min(1)
  .max(320)
  .describe(
    'Which Gmail account: its account id, its address, or its name ("Work"), as list_gmail_accounts gives them.',
  );

/**
 * Mail (`product/next-steps/mail.md` §3), the reads: the owner's own Gmail
 * accounts, searched in Gmail's query language, threads read in full, labels,
 * drafts, and attachments opened. Every tool works only the turn's owner's
 * accounts, and only reads: nothing is sent, changed or marked read.
 * Everything a sender wrote comes back inside `<email>`, marked as data.
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
      description:
        "Lists the person's own Gmail accounts connected to Oppenheimer: each one's name, address and account id, and whether it needs reconnecting. Every other mail tool takes one of these. An empty answer means none is connected.",
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
      description: `Searches the person's Gmail in Gmail's own search language, newest first: from:, to:, subject:, has:attachment, filename:pdf, is:unread, label:, in:inbox, newer_than:7d, after:2026/10/01, "exact words", OR, -word. Leave account out to search every connected account. Returns each message's id, thread id, date, sender, recipients, subject, labels, a snippet and its attachments (with the part id read_mail_attachment takes); read_mail_thread reads one in full. At most ${MAIL_SEARCH_LIMIT_MAX} per account per call; page_token (with account) gets the next page. Spam and Trash are left out unless include_spam_trash. Searching marks nothing read.`,
      input: z.object({
        query: z
          .string()
          .trim()
          .max(500)
          .default('')
          .describe('Gmail search terms; empty for the newest mail.'),
        account: account.optional(),
        limit: z.number().int().min(1).max(MAIL_SEARCH_LIMIT_MAX).default(10),
        page_token: z
          .string()
          .max(500)
          .optional()
          .describe('The next_page_token of an earlier answer, for the same account and query.'),
        include_spam_trash: z.boolean().default(false),
      }),
      run: async (input, context) => {
        if (input.page_token && !input.account) {
          throw new BotToolRefusal(
            'A page_token goes with the account it came from: give account too.',
          );
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
      description:
        "Reads one Gmail thread in full, oldest message first: each message's sender, recipients, reply-to, date, labels, attachments (with part ids) and its text. Long bodies are cut, and quoted history below a reply is often repeated, so read the newest message first. Reading marks nothing read.",
      input: z.object({
        account,
        thread_id: z.string().trim().min(1).max(100).describe('A thread id from search_mail.'),
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
      description:
        "Lists a Gmail account's labels: Gmail's own (INBOX, SENT, STARRED, IMPORTANT, CATEGORY_*) and the person's, with unread counts for the inbox and the person's labels. Use a label's name in search_mail as label:name.",
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
      description: `Lists the drafts saved in a Gmail account, newest first: each draft's id, recipients, subject, snippet and attachments. At most ${MAIL_SEARCH_LIMIT_MAX} per call; page_token gets the next page. read_mail_thread reads one in full by its thread id.`,
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
      description: `Opens one attachment of one message. PDFs (with a text layer), Word, Excel (as CSV per sheet) and PowerPoint files, text, CSV and HTML come back as text; images are shown to the person under your reply (you do not see them, so say what they are from the message). Other files, archives and scanned PDFs are not opened. Give the message id and the attachment's part id from search_mail or read_mail_thread. At most ${MAIL_ATTACHMENTS_PER_TURN} per turn.`,
      input: z.object({
        account,
        message_id: z.string().trim().min(1).max(100),
        part_id: z.string().trim().min(1).max(50).describe("The attachment's part id."),
      }),
      run: async (input, context) => {
        if (!context.budget.take('read_mail_attachment', MAIL_ATTACHMENTS_PER_TURN)) {
          return `Refused: this turn has already opened ${MAIL_ATTACHMENTS_PER_TURN} attachments, the limit. Answer with what you have.`;
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
          file.reading.truncated ? 'The file was longer; only its start is shown.' : '',
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
      return `"${file.filename}" is an image of ${formatSize(file.bytes.length)}, larger than the ${formatSize(BOT_IMAGE_MAX_BYTES)} the chat shows. It was not shown.`;
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
      content: `"${file.filename}" is an image; it is shown to the person under your reply. You do not see it: describe it from the message, or ask them.`,
      images: [attachment.toMessageAttachment()],
    };
  }
}
