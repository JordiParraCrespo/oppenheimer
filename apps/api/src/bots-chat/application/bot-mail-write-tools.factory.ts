import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import {
  type BotMailDraft,
  MAIL_RECIPIENTS_MAX,
  MAIL_SCHEDULE_MAX_DAYS,
  type MailPlan,
  mailPlanSchema,
} from '@oppenheimer/shared';
import { z } from 'zod/v4';
import { CancelScheduledMailCommand } from '../../mail/commands/cancel-scheduled-mail/cancel-scheduled-mail.command';
import { CreateMailDraftCommand } from '../../mail/commands/create-mail-draft/create-mail-draft.command';
import { DeleteMailDraftCommand } from '../../mail/commands/delete-mail-draft/delete-mail-draft.command';
import { ScheduleMailCommand } from '../../mail/commands/schedule-mail/schedule-mail.command';
import { SendMailCommand } from '../../mail/commands/send-mail/send-mail.command';
import { UpdateMailDraftCommand } from '../../mail/commands/update-mail-draft/update-mail-draft.command';
import type { MailSendEntity } from '../../mail/domain/mail-send.entity';
import type { MailRequest } from '../../mail/domain/mail-send.policy';
import type { GmailDraftRef } from '../../mail/infrastructure/gmail-provider.port';
import { FindSentMailQuery } from '../../mail/queries/find-sent-mail/find-sent-mail.query';
import { PlanMailQuery } from '../../mail/queries/plan-mail/plan-mail.query';
import { PlanMailDraftQuery } from '../../mail/queries/plan-mail-draft/plan-mail-draft.query';
import {
  describeAccount,
  describePlan,
  describeSend,
  draftCardOf,
  gmailDraftLink,
  gmailMessageLink,
  sendSummary,
} from '../bot-mail-tool.mapper';
import { promptText } from '../domain/bot-prompt-text.policy';
import { formatToolList, formatToolTime } from '../domain/bot-tool-text.policy';
import { BotMailAccountsResolver } from './bot-mail-accounts.resolver';
import { BotMailChatFilesResolver } from './bot-mail-chat-files.resolver';
import {
  type BotToolAnswer,
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

const account = z.string().trim().min(1).max(320).describe(promptText('tools/mail-write.account'));
const recipients = z
  .array(z.string().trim().min(3).max(320))
  .max(MAIL_RECIPIENTS_MAX)
  .default([])
  .describe(promptText('tools/mail-write.recipients'));

/** What a message is, as create_draft, update_draft and send_mail take it. */
const message = z.object({
  account,
  kind: z
    .enum(['new', 'reply', 'reply_all', 'forward'])
    .default('new')
    .describe(promptText('tools/mail-write.message-kind')),
  message_id: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe(promptText('tools/mail-write.message-message-id')),
  to: recipients,
  cc: recipients,
  bcc: recipients,
  subject: z
    .string()
    .trim()
    .max(500)
    .optional()
    .describe(promptText('tools/mail-write.message-subject')),
  body: z.string().max(50_000).describe(promptText('tools/mail-write.message-body')),
  from: z.string().trim().max(320).optional().describe(promptText('tools/mail-write.message-from')),
  signature: z.boolean().default(true).describe(promptText('tools/mail-write.message-signature')),
  attachments: z
    .array(
      z.union([
        z.object({ message_id: z.string().min(1).max(100), part_id: z.string().min(1).max(50) }),
        z.object({ chat_image: z.string().uuid() }),
      ]),
    )
    .max(25)
    .default([])
    .describe(promptText('tools/mail-write.message-attachments')),
});

type MessageInput = z.output<typeof message>;

/** Filled by Oppenheimer when the card is raised: the message exactly as it will go. */
const plan = z
  .record(z.string(), z.unknown())
  .optional()
  .describe(promptText('tools/mail-write.plan-leave-out-oppenheimer'));

/**
 * Mail, the writes: drafts written freely into the owner's Gmail, since a draft
 * never sends; a draft deleted after asking; and sending, which asks every
 * time, whatever the bot's preset. A send card stores the planned message
 * (alias, recipients, subject, body, threading, files) and a yes sends exactly
 * that, once.
 */
@Injectable()
export class BotMailWriteToolsFactory implements BotToolArea {
  readonly group = 'mail' as const;

  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    private readonly accounts: BotMailAccountsResolver,
    private readonly chatFiles: BotMailChatFilesResolver,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [
      this.createDraft(),
      this.updateDraft(),
      this.deleteDraft(),
      this.sendMail(),
      this.sendDraft(),
      this.scheduleMail(),
      this.cancelScheduled(),
      this.listSent(),
    ];
  }

  private createDraft(): BotToolDefinition {
    return defineBotTool({
      name: 'create_draft',
      scope: 'mail:write',
      description: promptText('tools/mail-write.create-draft'),
      input: message,
      run: async (input, context) => {
        const planned = await this.plan(input, context);
        const draft = await this.commandBus.execute<CreateMailDraftCommand, GmailDraftRef>(
          new CreateMailDraftCommand({
            scope: context.owner,
            plan: planned,
            localFiles: await this.chatFiles.bytes(planned, context),
          }),
        );
        return draftAnswer('created', planned, draft);
      },
    });
  }

  private updateDraft(): BotToolDefinition {
    return defineBotTool({
      name: 'update_draft',
      scope: 'mail:write',
      description: promptText('tools/mail-write.update-draft'),
      input: message.extend({
        draft_id: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .describe(promptText('tools/mail-write.update-draft-draft-id')),
      }),
      run: async (input, context) => {
        const planned = await this.plan(input, context);
        const draft = await this.commandBus.execute<UpdateMailDraftCommand, GmailDraftRef>(
          new UpdateMailDraftCommand({
            scope: context.owner,
            draftId: input.draft_id,
            plan: planned,
            localFiles: await this.chatFiles.bytes(planned, context),
          }),
        );
        return draftAnswer('updated', planned, draft);
      },
    });
  }

  private deleteDraft(): BotToolDefinition {
    return defineBotTool({
      name: 'delete_draft',
      asks: true,
      scope: 'mail:write',
      description: promptText('tools/mail-write.delete-draft'),
      input: z.object({
        account,
        draft_id: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .describe(promptText('tools/mail-write.update-draft-draft-id')),
      }),
      // The card stores the account's id: a rename while it waits does not change what a yes deletes.
      normalize: async (input, context) => ({
        ...input,
        account: (await this.accounts.one(context.owner, input.account)).id,
      }),
      summarize: async (input, context) => {
        const planned = await this.draftPlan(input, context);
        return `Delete the draft "${planned.subject}" to ${planned.to.join(', ') || 'nobody'} from ${planned.accountEmail}`;
      },
      run: async (input, context) => {
        const connection = await this.accounts.one(context.owner, input.account);
        await this.commandBus.execute(
          new DeleteMailDraftCommand({
            scope: context.owner,
            connectionId: connection.id,
            draftId: input.draft_id,
          }),
        );
        return `Draft ${input.draft_id} deleted from ${describeAccount(connection)}.`;
      },
    });
  }

  private sendMail(): BotToolDefinition {
    return this.sending({
      name: 'send_mail',
      description: promptText('tools/mail-write.send-mail', {
        mailRecipientsMax: String(MAIL_RECIPIENTS_MAX),
      }),
      input: message.extend({ plan }),
      planOf: (input, context) => this.plan(input, context),
    });
  }

  private scheduleMail(): BotToolDefinition {
    return defineBotTool({
      name: 'schedule_mail',
      asks: 'always',
      perCallOnly: true,
      scope: 'mail:write',
      description: promptText('tools/mail-write.schedule-mail', {
        mailScheduleMaxDays: String(MAIL_SCHEDULE_MAX_DAYS),
      }),
      input: message.partial({ body: true }).extend({
        send_at: z
          .string()
          .datetime({ offset: true })
          .describe(promptText('tools/mail-write.schedule-mail-send-at')),
        draft_id: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .optional()
          .describe(promptText('tools/mail-write.schedule-mail-draft-id')),
        plan,
      }),
      normalize: async (input, context) => ({
        ...input,
        plan: input.draft_id
          ? await this.draftPlan({ account: input.account, draft_id: input.draft_id }, context)
          : await this.plan({ ...input, body: input.body ?? '' }, context),
      }),
      summarize: (input, context) =>
        `At ${formatToolTime(new Date(input.send_at), context.timeZone)}: ${sendSummary(storedPlan(input.plan))}`,
      run: async (input, context) => {
        const approvalId = approvedCard(context, 'scheduled', 'schedule_mail');
        const planned = storedPlan(input.plan);
        const id = await this.commandBus.execute<ScheduleMailCommand, AggregateID>(
          new ScheduleMailCommand({
            scope: context.owner,
            plan: planned,
            sendAt: new Date(input.send_at),
            approvalId,
            botId: context.botId,
          }),
        );
        return promptText('tools/mail-write.schedule-mail-scheduled-id-from', {
          id,
          email: planned.from.email,
          formatToolTime: formatToolTime(new Date(input.send_at), context.timeZone),
          subject: planned.subject,
        });
      },
    });
  }

  private cancelScheduled(): BotToolDefinition {
    return defineBotTool({
      name: 'cancel_scheduled_mail',
      scope: 'mail:write',
      description: promptText('tools/mail-write.cancel-scheduled-mail'),
      input: z.object({
        id: z.string().uuid().describe(promptText('tools/mail-write.cancel-scheduled-mail-id')),
      }),
      run: async (input, context) => {
        await this.commandBus.execute(
          new CancelScheduledMailCommand({ scope: context.owner, sendId: input.id }),
        );
        return promptText('tools/mail-write.cancel-scheduled-mail-done', {
          id: input.id,
        });
      },
    });
  }

  private sendDraft(): BotToolDefinition {
    return this.sending({
      name: 'send_draft',
      description: promptText('tools/mail-write.send-draft'),
      input: z.object({
        account,
        draft_id: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .describe(promptText('tools/mail-write.update-draft-draft-id')),
        plan,
      }),
      planOf: (input, context) => this.draftPlan(input, context),
    });
  }

  /**
   * A tool that sends: it asks under every preset, the card stores the plan
   * `planOf` makes, and a yes sends that plan and nothing else, once. The send
   * tools differ only in where the plan comes from.
   */
  private sending<Input extends z.ZodType<{ plan?: Record<string, unknown> }>>(tool: {
    name: string;
    description: string;
    input: Input;
    planOf: (input: z.output<Input>, context: BotToolCallContext) => Promise<MailPlan>;
  }): BotToolDefinition {
    return defineBotTool({
      name: tool.name,
      asks: 'always',
      perCallOnly: true,
      scope: 'mail:write',
      description: tool.description,
      input: tool.input,
      normalize: async (input, context) => ({ ...input, plan: await tool.planOf(input, context) }),
      summarize: (input) => sendSummary(storedPlan(input.plan)),
      run: async (input, context) => this.send(storedPlan(input.plan), context, tool.name),
    });
  }

  private listSent(): BotToolDefinition {
    return defineBotTool({
      name: 'list_sent_mail',
      readOnly: true,
      scope: 'mail:read',
      description: promptText('tools/mail-write.list-sent-mail'),
      input: z.object({ limit: z.number().int().min(1).max(50).default(20) }),
      run: async (input, context) => {
        const sends = await this.queryBus.execute<FindSentMailQuery, MailSendEntity[]>(
          new FindSentMailQuery({ scope: context.owner, limit: input.limit }),
        );
        return formatToolList(
          'Sent by bots',
          sends.map((send) => describeSend(send, context.timeZone)),
          promptText('tools/mail-write.list-sent-mail-bot-has-sent'),
        );
      },
    });
  }

  private async send(
    planned: MailPlan,
    context: BotToolCallContext & { approvalId?: string },
    tool: string,
  ) {
    const approvalId = approvedCard(context, 'sent', tool);
    await this.commandBus.execute<SendMailCommand, AggregateID>(
      new SendMailCommand({
        scope: context.owner,
        plan: planned,
        approvalId,
        botId: context.botId,
        localFiles: await this.chatFiles.bytes(planned, context),
      }),
    );
    return promptText('tools/mail-write.send', {
      email: planned.from.email,
      value: [...planned.to, ...planned.cc, ...planned.bcc].join(', '),
      subject: planned.subject,
    });
  }

  private async plan(input: MessageInput, context: BotToolCallContext): Promise<MailPlan> {
    if (input.kind !== 'new' && !input.message_id) {
      throw new BotToolRefusal(
        promptText('tools/mail-write.plan-names-message-answers', { kind: input.kind }),
      );
    }
    const connection = await this.accounts.one(context.owner, input.account);
    return this.queryBus.execute<PlanMailQuery, MailPlan>(
      new PlanMailQuery({
        scope: context.owner,
        connectionId: connection.id,
        request: {
          ...requestOf(input),
          localFiles: await this.chatFiles.planned(chatImagesOf(input.attachments), context),
        },
      }),
    );
  }

  private async draftPlan(
    input: { account: string; draft_id: string },
    context: BotToolCallContext,
  ): Promise<MailPlan> {
    const connection = await this.accounts.one(context.owner, input.account);
    return this.queryBus.execute<PlanMailDraftQuery, MailPlan>(
      new PlanMailDraftQuery({
        scope: context.owner,
        connectionId: connection.id,
        draftId: input.draft_id,
      }),
    );
  }
}

/** The chat images among a call's files, by id. */
function chatImagesOf(attachments: MessageInput['attachments']): string[] {
  return attachments.flatMap((file) => ('chat_image' in file ? [file.chat_image] : []));
}

function requestOf(input: MessageInput): Omit<MailRequest, 'localFiles'> {
  return {
    kind: input.kind,
    messageId: input.message_id ?? null,
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject ?? null,
    body: input.body,
    from: input.from ?? null,
    signature: input.signature,
    attachments: input.attachments.flatMap((file) =>
      'message_id' in file ? [{ messageId: file.message_id, partId: file.part_id }] : [],
    ),
  };
}

/** The plan the card stored; a call carried out without one is refused, never planned anew. */
/**
 * The approval a mail write carries out: a yes on its card, or a refusal. A
 * write that always asks runs only from its card, never on its own.
 */
function approvedCard(
  context: { approvalId?: string },
  done: 'sent' | 'scheduled',
  tool: string,
): string {
  if (!context.approvalId) {
    throw new BotToolRefusal(promptText('tools/mail-write.approved-card', { done, tool }));
  }
  return context.approvalId;
}

function storedPlan(stored: unknown): MailPlan {
  const parsed = mailPlanSchema.safeParse(stored);
  if (!parsed.success) {
    throw new BotToolRefusal(promptText('tools/mail-write.stored-plan'));
  }
  return parsed.data;
}

function draftAnswer(
  saved: BotMailDraft['saved'],
  planned: MailPlan,
  draft: GmailDraftRef,
): BotToolAnswer {
  const said = saved === 'created' ? 'Draft saved' : 'Draft updated';
  return {
    content: [
      promptText('tools/mail-write.draft-answer-content', {
        said,
        accountEmail: planned.accountEmail,
        draftId: draft.draftId,
      }),
      describePlan(planned),
      `Open it in Gmail: ${gmailDraftLink(planned.accountEmail, draft.messageId)}`,
      `Its thread: ${gmailMessageLink(planned.accountEmail, draft.threadId)}`,
    ].join('\n'),
    mailDraft: draftCardOf(saved, planned, draft),
  };
}
