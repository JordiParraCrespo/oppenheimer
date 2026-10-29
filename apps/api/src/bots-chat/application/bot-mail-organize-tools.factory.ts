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
import { describeAccount, describeLabel } from '../bot-mail-tool.mapper';
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
const threads = ids('Thread');
const labelNames = z
  .array(z.string().trim().min(1).max(225))
  .max(20)
  .default([])
  .describe('Labels by name or id, as list_mail_labels gives them.');

/** Threads and messages to change: at least one, at most `MAIL_ORGANIZE_MAX` together. */
const targets = z.object({ account, thread_ids: threads, message_ids: ids('Message') });
type Targets = z.output<typeof targets>;

/** Filled by Oppenheimer when the card is raised: each label's name, by the id it resolved to. */
const resolvedNames = z
  .record(z.string(), z.string())
  .optional()
  .describe('Leave out: Oppenheimer fills it in.');

/**
 * Mail (`product/next-steps/mail.md` §3.5), organizing: read state, stars,
 * importance, labels, the inbox and Trash, on threads or messages of the
 * owner's Gmail. Each asks under Approve for me and can run on its own under
 * Approve everything, except `trash_mail`, which asks every time; bringing
 * threads back from Trash never asks. One call touches at most
 * `MAIL_ORGANIZE_MAX`; nothing is ever deleted for good.
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
    const input = targets.extend({
      read: z.boolean().optional().describe('true marks read, false unread.'),
      starred: z.boolean().optional().describe('true stars, false takes the star off.'),
      important: z.boolean().optional().describe('true marks important, false not important.'),
    });
    return defineBotTool({
      name: 'mark_mail',
      asks: true,
      scope: 'mail:write',
      description: `Marks threads or messages of the person's Gmail read or unread, starred or not, important or not. Give only the marks to change. Searching and reading never mark anything; only this does. At most ${MAIL_ORGANIZE_MAX} at once.`,
      input,
      summarize: async (call, context) =>
        `Mark ${countOf(call)} ${marksOf(call)} in ${describeAccount(await this.connection(call, context))}`,
      run: async (call, context) => {
        const change = markChange(call);
        if (change.add.length + change.remove.length === 0) {
          throw new BotToolRefusal('Say which marks to change: read, starred or important.');
        }
        const outcome = await this.organize(call, change, context);
        return `Marked ${marksOf(call)}: ${answerOf(outcome)}`;
      },
    });
  }

  private labelMail(): BotToolDefinition {
    const input = targets.extend({
      add: labelNames.describe('Labels to put on, by name or id.'),
      remove: labelNames.describe('Labels to take off, by name or id.'),
      names: resolvedNames,
    });
    return defineBotTool({
      name: 'label_mail',
      asks: true,
      scope: 'mail:write',
      description: `Puts labels on threads or messages of the person's Gmail, or takes them off. Name each label as list_mail_labels gives it; create_label makes a new one. At most ${MAIL_ORGANIZE_MAX} threads or messages at once.`,
      input,
      // The card stores the labels' ids, so a yes changes the labels it named even if one is renamed.
      normalize: async (call, context) => {
        const labels = await this.labels(call, context);
        const add = call.add.map((name) => labelFor(labels, name));
        const remove = call.remove.map((name) => labelFor(labels, name));
        return {
          ...call,
          add: add.map((label) => label.id),
          remove: remove.map((label) => label.id),
          names: Object.fromEntries([...add, ...remove].map((label) => [label.id, label.name])),
        };
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
        return `In ${describeAccount(await this.connection(call, context))}, ${what} ${countOf(call)}`;
      },
      run: async (call, context) => {
        if (call.add.length + call.remove.length === 0) {
          throw new BotToolRefusal('Name at least one label to put on or take off.');
        }
        const labels = await this.labels(call, context);
        const change = {
          add: call.add.map((name) => labelFor(labels, name).id),
          remove: call.remove.map((name) => labelFor(labels, name).id),
        };
        return `Labels changed: ${answerOf(await this.organize(call, change, context))}`;
      },
    });
  }

  private archiveMail(): BotToolDefinition {
    const input = z.object({ account, thread_ids: threads });
    return defineBotTool({
      name: 'archive_mail',
      asks: true,
      scope: 'mail:write',
      description: `Takes threads out of the person's Gmail inbox; they stay in All Mail with their labels, and come back on a reply. At most ${MAIL_ORGANIZE_MAX} threads at once.`,
      input,
      summarize: async (call, context) =>
        `Archive ${threadCount(call.thread_ids)} in ${describeAccount(await this.connection(call, context))}`,
      run: async (call, context) =>
        `Archived: ${answerOf(await this.organize({ ...call, message_ids: [] }, ARCHIVE_CHANGE, context))}`,
    });
  }

  private trashMail(): BotToolDefinition {
    const input = z.object({ account, thread_ids: threads });
    return defineBotTool({
      name: 'trash_mail',
      asks: 'always',
      scope: 'mail:write',
      description: `Moves threads of the person's Gmail to Trash, which Gmail empties after 30 days; untrash_mail brings them back until then. Always asks the person first. Nothing is ever deleted for good. At most ${MAIL_ORGANIZE_MAX} threads at once.`,
      input,
      summarize: async (call, context) =>
        `Move ${threadCount(call.thread_ids)} to Trash in ${describeAccount(await this.connection(call, context))} (Gmail empties Trash after 30 days)`,
      run: async (call, context) =>
        `Moved to Trash: ${answerOf(await this.trash(call, true, context))}`,
    });
  }

  private untrashMail(): BotToolDefinition {
    return defineBotTool({
      name: 'untrash_mail',
      scope: 'mail:write',
      description: `Brings threads of the person's Gmail back out of Trash, where they were before. At most ${MAIL_ORGANIZE_MAX} threads at once.`,
      input: z.object({ account, thread_ids: threads }),
      run: async (call, context) =>
        `Brought back from Trash: ${answerOf(await this.trash(call, false, context))}`,
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

  private async labels(call: { account: string }, context: BotToolCallContext) {
    const connection = await this.connection(call, context);
    return this.queryBus.execute<FindMailLabelsQuery, GmailLabel[]>(
      new FindMailLabelsQuery({ scope: context.owner, connectionId: connection.id }),
    );
  }

  private async organize(
    call: Targets,
    change: MailLabelChange,
    context: BotToolCallContext,
  ): Promise<GmailBulkOutcome> {
    assertTargets(call.thread_ids.length + call.message_ids.length);
    const connection = await this.connection(call, context);
    return this.commandBus.execute<OrganizeMailCommand, GmailBulkOutcome>(
      new OrganizeMailCommand({
        scope: context.owner,
        connectionId: connection.id,
        threadIds: call.thread_ids,
        messageIds: call.message_ids,
        change,
      }),
    );
  }

  private async trash(
    call: { account: string; thread_ids: string[] },
    trash: boolean,
    context: BotToolCallContext,
  ): Promise<GmailBulkOutcome> {
    assertTargets(call.thread_ids.length);
    const connection = await this.connection(call, context);
    return this.commandBus.execute<TrashMailCommand, GmailBulkOutcome>(
      new TrashMailCommand({
        scope: context.owner,
        connectionId: connection.id,
        threadIds: call.thread_ids,
        trash,
      }),
    );
  }
}

/** A label by its id, or its name ignoring case; one the account lacks is refused with the hint. */
function labelFor(labels: readonly GmailLabel[], wanted: string): GmailLabel {
  const needle = wanted.trim().toLowerCase();
  const found =
    labels.find((label) => label.id === wanted.trim()) ??
    labels.find((label) => label.name.toLowerCase() === needle);
  if (!found) {
    throw new BotToolRefusal(
      `No label "${wanted}" in this account. list_mail_labels gives them; create_label makes a new one.`,
    );
  }
  return found;
}

function assertTargets(count: number): void {
  if (count === 0) throw new BotToolRefusal('Name the threads or messages to change.');
  if (count > MAIL_ORGANIZE_MAX) {
    throw new BotToolRefusal(
      `${count} at once; one call changes at most ${MAIL_ORGANIZE_MAX}. Split them over several calls.`,
    );
  }
}

function threadCount(threadIds: readonly string[]): string {
  return threadIds.length === 1 ? '1 thread' : `${threadIds.length} threads`;
}

/** "3 threads and 2 messages", for a card. */
function countOf(call: Targets): string {
  const parts = [
    call.thread_ids.length ? threadCount(call.thread_ids) : null,
    call.message_ids.length
      ? call.message_ids.length === 1
        ? '1 message'
        : `${call.message_ids.length} messages`
      : null,
  ].filter(Boolean);
  return parts.join(' and ') || 'nothing';
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

/** What a change did, in one line: how many, and the ids Gmail did not have. */
function answerOf(outcome: GmailBulkOutcome): string {
  const done = `${outcome.changed.length} changed`;
  return outcome.missing.length
    ? `${done}; Gmail has no ${outcome.missing.join(', ')} (deleted, or an id from another account)`
    : `${done}.`;
}
