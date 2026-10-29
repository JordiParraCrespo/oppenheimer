import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { MAIL_ORGANIZE_MAX } from '@oppenheimer/shared';
import { z } from 'zod/v4';
import { CreateMailLabelCommand } from '../../mail/commands/create-mail-label/create-mail-label.command';
import { OrganizeMailCommand } from '../../mail/commands/organize-mail/organize-mail.command';
import { TrashMailCommand } from '../../mail/commands/trash-mail/trash-mail.command';
import {
  ARCHIVE_CHANGE,
  type MailLabelChange,
  type MailMarks,
  markChange,
} from '../../mail/domain/mail-organize.policy';
import type { GmailBulkOutcome, GmailLabel } from '../../mail/infrastructure/gmail-provider.port';
import { FindMailLabelsQuery } from '../../mail/queries/find-mail-labels/find-mail-labels.query';
import {
  describeAccount,
  describeLabel,
  labelChangeOf,
  organizeAnswer,
  targetCount,
} from '../bot-mail-tool.mapper';
import { BotMailAccountsResolver } from './bot-mail-accounts.resolver';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

const account = z
  .string()
  .trim()
  .min(1)
  .max(320)
  .describe(
    'Which Gmail account: its account id, its address, or its name, as list_gmail_accounts gives them.',
  );
const ids = (what: string) =>
  z
    .array(z.string().trim().min(1).max(100))
    .max(MAIL_ORGANIZE_MAX)
    .default([])
    .describe(
      `${what} ids, as search_mail and read_mail_thread give them; at most ${MAIL_ORGANIZE_MAX}.`,
    );
const labelNames = z
  .array(z.string().trim().min(1).max(225))
  .max(20)
  .default([])
  .describe('Labels by name or id, as list_mail_labels gives them.');

/** Threads and messages to change: at least one, at most `MAIL_ORGANIZE_MAX` together. */
const targets = z.object({ account, thread_ids: ids('Thread'), message_ids: ids('Message') });
const threadsOnly = z.object({ account, thread_ids: ids('Thread') });
type Targets = { account: string; thread_ids: string[]; message_ids?: string[] };

/** Filled by Oppenheimer when the card is raised: each label's name, by the id it resolved to. */
const resolvedNames = z
  .record(z.string(), z.string())
  .optional()
  .describe('Leave out: Oppenheimer fills it in.');

/**
 * Labels a bot may not put on mail itself: Trash and Spam move it out of
 * sight (`trash_mail` asks every time; nothing marks spam), and Gmail keeps
 * Drafts and Sent for itself.
 */
const RESERVED_ADD = new Set(['TRASH', 'SPAM', 'DRAFT', 'SENT']);

/**
 * Mail (`product/next-steps/mail.md` §3.5), organizing: read state, stars,
 * importance, labels, the inbox and Trash, on threads or messages of the
 * owner's Gmail. Each asks under Approve for me and can run on its own under
 * Approve everything, except `trash_mail`, which asks every time; bringing
 * threads back from Trash never asks. A card stores the account's id and the
 * labels' ids, so a rename while it waits does not change what a yes does,
 * and a call that changes nothing or more than `MAIL_ORGANIZE_MAX` is refused
 * before any card is raised. Nothing is ever deleted for good.
 */
@Injectable()
export class BotMailOrganizeToolsFactory implements BotToolArea {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    private readonly accounts: BotMailAccountsResolver,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [
      this.markMail(),
      this.labelMail(),
      this.archiveMail(),
      this.trashMail(),
      this.untrashMail(),
      this.createLabel(),
    ];
  }

  private markMail(): BotToolDefinition {
    return defineBotTool({
      name: 'mark_mail',
      asks: true,
      scope: 'mail:write',
      description: `Marks threads or messages of the person's Gmail read or unread, starred or not, important or not. Give only the marks to change. Searching and reading never mark anything; only this does. At most ${MAIL_ORGANIZE_MAX} at once.`,
      input: targets.extend({
        read: z.boolean().optional().describe('true marks read, false unread.'),
        starred: z.boolean().optional().describe('true stars, false takes the star off.'),
        important: z.boolean().optional().describe('true marks important, false not important.'),
      }),
      normalize: (call, context) => {
        changeOf(markChange(call));
        return this.frozen(call, context);
      },
      summarize: async (call, context) =>
        `Mark ${targetCount(call)} ${marksOf(call)} in ${describeAccount(await this.connection(call, context))}`,
      run: async (call, context) =>
        `Marked ${marksOf(call)}: ${organizeAnswer(await this.change(call, changeOf(markChange(call)), context))}`,
    });
  }

  private labelMail(): BotToolDefinition {
    return defineBotTool({
      name: 'label_mail',
      asks: true,
      scope: 'mail:write',
      description: `Puts labels on threads or messages of the person's Gmail, or takes them off. Name each label as list_mail_labels gives it; create_label makes a new one. To trash mail, use trash_mail. At most ${MAIL_ORGANIZE_MAX} threads or messages at once.`,
      input: targets.extend({
        add: labelNames.describe('Labels to put on, by name or id.'),
        remove: labelNames.describe('Labels to take off, by name or id.'),
        names: resolvedNames,
      }),
      // The card stores the labels' ids, so a yes changes the labels it named even if one is renamed.
      normalize: async (call, context) => {
        const frozen = await this.frozen(call, context);
        const change = await this.labelChange(frozen, context);
        return { ...frozen, add: change.add, remove: change.remove, names: change.names };
      },
      summarize: async (call, context) => {
        const named = (list: string[]) =>
          list.map((id) => `"${call.names?.[id] ?? id}"`).join(', ');
        const what = [
          call.add.length ? `put ${named(call.add)} on` : null,
          call.remove.length ? `take ${named(call.remove)} off` : null,
        ]
          .filter(Boolean)
          .join(' and ');
        return `In ${describeAccount(await this.connection(call, context))}, ${what} ${targetCount(call)}`;
      },
      // Approved, the call holds ids; run on its own, names: either resolves the same way.
      run: async (call, context) =>
        `Labels changed: ${organizeAnswer(await this.change(call, await this.labelChange(call, context), context))}`,
    });
  }

  private archiveMail(): BotToolDefinition {
    return defineBotTool({
      name: 'archive_mail',
      asks: true,
      scope: 'mail:write',
      description: `Takes threads out of the person's Gmail inbox; they stay in All Mail with their labels, and come back on a reply. At most ${MAIL_ORGANIZE_MAX} threads at once.`,
      input: threadsOnly,
      normalize: (call, context) => this.frozen(call, context),
      summarize: async (call, context) =>
        `Archive ${targetCount(call)} in ${describeAccount(await this.connection(call, context))}`,
      run: async (call, context) =>
        `Archived: ${organizeAnswer(await this.change(call, ARCHIVE_CHANGE, context))}`,
    });
  }

  private trashMail(): BotToolDefinition {
    return defineBotTool({
      name: 'trash_mail',
      asks: 'always',
      scope: 'mail:write',
      description: `Moves threads of the person's Gmail to Trash, which Gmail empties after 30 days; untrash_mail brings them back until then. Always asks the person first. Nothing is ever deleted for good. At most ${MAIL_ORGANIZE_MAX} threads at once.`,
      input: threadsOnly,
      normalize: (call, context) => this.frozen(call, context),
      summarize: async (call, context) =>
        `Move ${targetCount(call)} to Trash in ${describeAccount(await this.connection(call, context))} (Gmail empties Trash after 30 days)`,
      run: async (call, context) =>
        `Moved to Trash: ${organizeAnswer(await this.trash(call, true, context))}`,
    });
  }

  private untrashMail(): BotToolDefinition {
    return defineBotTool({
      name: 'untrash_mail',
      scope: 'mail:write',
      description: `Brings threads of the person's Gmail back out of Trash, where they were before. At most ${MAIL_ORGANIZE_MAX} threads at once.`,
      input: threadsOnly,
      run: async (call, context) =>
        `Brought back from Trash: ${organizeAnswer(await this.trash(call, false, context))}`,
    });
  }

  private createLabel(): BotToolDefinition {
    return defineBotTool({
      name: 'create_label',
      asks: true,
      scope: 'mail:write',
      description:
        'Creates a label in the person\'s Gmail, shown in its label list. Use "Parent/Child" to nest it. label_mail then puts it on mail.',
      input: z.object({ account, name: z.string().trim().min(1).max(225) }),
      normalize: async (call, context) => ({
        ...call,
        account: (await this.connection(call, context)).id,
      }),
      summarize: async (call, context) =>
        `Create the label "${call.name}" in ${describeAccount(await this.connection(call, context))}`,
      run: async (call, context) => {
        const connection = await this.connection(call, context);
        const label = await this.commandBus.execute<CreateMailLabelCommand, GmailLabel>(
          new CreateMailLabelCommand({
            scope: context.owner,
            connectionId: connection.id,
            name: call.name,
          }),
        );
        return `Label created in ${describeAccount(connection)}: ${describeLabel(label)}`;
      },
    });
  }

  private connection(call: { account: string }, context: BotToolCallContext) {
    return this.accounts.one(context.owner, call.account);
  }

  /**
   * A call as its card stores it: refused here if it changes nothing or too
   * much, before anyone is asked, and its account frozen to its id.
   */
  private async frozen<Call extends Targets>(
    call: Call,
    context: BotToolCallContext,
  ): Promise<Call> {
    assertTargets(call);
    return { ...call, account: (await this.connection(call, context)).id };
  }

  /** The labels a call names, as ids; a name the account has no label for is refused. */
  private async labelChange(
    call: { account: string; add: string[]; remove: string[] },
    context: BotToolCallContext,
  ) {
    assertNotReserved(call.add);
    const connection = await this.connection(call, context);
    const labels = await this.queryBus.execute<FindMailLabelsQuery, GmailLabel[]>(
      new FindMailLabelsQuery({ scope: context.owner, connectionId: connection.id }),
    );
    const change = labelChangeOf(labels, call.add, call.remove);
    if (change.missing.length) {
      throw new BotToolRefusal(
        `No label ${change.missing.map((name) => `"${name}"`).join(', ')} in this account. list_mail_labels gives them; create_label makes a new one.`,
      );
    }
    return changeOf(change);
  }

  private change(
    call: Targets,
    change: MailLabelChange,
    context: BotToolCallContext,
  ): Promise<GmailBulkOutcome> {
    assertNotReserved(change.add);
    return this.write(
      call,
      context,
      (connectionId) =>
        new OrganizeMailCommand({
          scope: context.owner,
          connectionId,
          threadIds: call.thread_ids,
          messageIds: call.message_ids ?? [],
          change,
        }),
    );
  }

  private trash(call: Targets, trash: boolean, context: BotToolCallContext) {
    return this.write(
      call,
      context,
      (connectionId) =>
        new TrashMailCommand({
          scope: context.owner,
          connectionId,
          threadIds: call.thread_ids,
          trash,
        }),
    );
  }

  /** One organizing write: its targets checked, its account found, its command sent. */
  private async write(
    call: Targets,
    context: BotToolCallContext,
    command: (connectionId: string) => OrganizeMailCommand | TrashMailCommand,
  ): Promise<GmailBulkOutcome> {
    assertTargets(call);
    const connection = await this.connection(call, context);
    return this.commandBus.execute<OrganizeMailCommand | TrashMailCommand, GmailBulkOutcome>(
      command(connection.id),
    );
  }
}

/** A label change, refused when it changes nothing. */
function changeOf<Change extends MailLabelChange>(change: Change): Change {
  if (change.add.length + change.remove.length === 0) {
    throw new BotToolRefusal(
      'Say what to change: which marks, or which labels to put on or take off.',
    );
  }
  return change;
}

/** Trash and its kin are refused by name or id, before any label is looked up. */
function assertNotReserved(added: readonly string[]): void {
  if (added.some((label) => RESERVED_ADD.has(label.trim().toUpperCase()))) {
    throw new BotToolRefusal(
      'Trash, Spam, Drafts and Sent are not labels a bot puts on mail. Use trash_mail to trash it.',
    );
  }
}

function assertTargets(call: Targets): void {
  const count = call.thread_ids.length + (call.message_ids?.length ?? 0);
  if (count === 0) throw new BotToolRefusal('Name the threads or messages to change.');
  if (count > MAIL_ORGANIZE_MAX) {
    throw new BotToolRefusal(
      `${count} at once; one call changes at most ${MAIL_ORGANIZE_MAX}. Split them over several calls.`,
    );
  }
}

/** "read and starred", "unread and not important". */
function marksOf(marks: MailMarks): string {
  const words = [
    marks.read === undefined ? null : marks.read ? 'read' : 'unread',
    marks.starred === undefined ? null : marks.starred ? 'starred' : 'not starred',
    marks.important === undefined ? null : marks.important ? 'important' : 'not important',
  ].filter(Boolean);
  return words.join(' and ') || 'as they are';
}
