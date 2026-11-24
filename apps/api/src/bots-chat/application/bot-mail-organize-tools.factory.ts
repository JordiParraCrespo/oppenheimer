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
import { promptText } from '../domain/bot-prompt-text.policy';
import { BotMailAccountsResolver } from './bot-mail-accounts.resolver';
import {
  type BotToolAnswer,
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
  .describe(promptText('mail/tools-organize.account'));
const ids = (what: string) =>
  z
    .array(z.string().trim().min(1).max(100))
    .max(MAIL_ORGANIZE_MAX)
    .default([])
    .describe(
      promptText('mail/tools-organize.ids', { what, mailOrganizeMax: String(MAIL_ORGANIZE_MAX) }),
    );
const labelNames = z
  .array(z.string().trim().min(1).max(225))
  .max(20)
  .default([])
  .describe(promptText('mail/tools-organize.label-names'));

/** Threads and messages to change: at least one, at most `MAIL_ORGANIZE_MAX` together. */
const targets = z.object({ account, thread_ids: ids('Thread'), message_ids: ids('Message') });
const threadsOnly = z.object({ account, thread_ids: ids('Thread') });
type Targets = { account: string; thread_ids: string[]; message_ids?: string[] };

/** Filled by Oppenheimer when the card is raised: each label's name, by the id it resolved to. */
const resolvedNames = z
  .record(z.string(), z.string())
  .optional()
  .describe(promptText('mail/tools-organize.resolved-names'));

/**
 * Labels a bot may not put on mail itself: Trash and Spam move it out of
 * sight (`trash_mail` asks until the owner allows it; nothing marks spam),
 * and Gmail keeps Drafts and Sent for itself.
 */
const RESERVED_ADD = new Set(['TRASH', 'SPAM', 'DRAFT', 'SENT']);

/**
 * Mail, organizing: read state, stars, importance, labels, the inbox and Trash,
 * on threads or messages of the owner's Gmail. Each asks under Approve for me
 * and runs on its own under Full access, except `trash_mail`, which asks under
 * Full access too until the owner allows it (Settings, or "always" on its
 * card); bringing threads back from Trash never asks. A card stores the
 * account's id and the labels' ids, so a rename while it waits does not change
 * what a yes does, and a call that changes nothing or more than
 * `MAIL_ORGANIZE_MAX` is refused before any card is raised. Nothing is ever
 * deleted for good.
 */
@Injectable()
export class BotMailOrganizeToolsFactory implements BotToolArea {
  readonly group = 'mail' as const;

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
      description: promptText('mail/tools-organize.mark-mail', {
        mailOrganizeMax: String(MAIL_ORGANIZE_MAX),
      }),
      input: targets.extend({
        read: z.boolean().optional().describe(promptText('mail/tools-organize.mark-mail-read')),
        starred: z
          .boolean()
          .optional()
          .describe(promptText('mail/tools-organize.mark-mail-starred')),
        important: z
          .boolean()
          .optional()
          .describe(promptText('mail/tools-organize.mark-mail-important')),
      }),
      normalize: (call, context) => {
        assertChanges(markChange(call));
        return this.frozen(call, context);
      },
      summarize: async (call, context) =>
        `Mark ${targetCount(call)} ${marksOf(call)} in ${describeAccount(await this.connection(call, context))}`,
      run: async (call, context) =>
        organized(
          `Marked ${marksOf(call)}`,
          await this.change(call, changeOf(markChange(call)), context),
        ),
    });
  }

  private labelMail(): BotToolDefinition {
    return defineBotTool({
      name: 'label_mail',
      asks: true,
      scope: 'mail:write',
      description: promptText('mail/tools-organize.label-mail', {
        mailOrganizeMax: String(MAIL_ORGANIZE_MAX),
      }),
      input: targets.extend({
        add: labelNames.describe(promptText('mail/tools-organize.label-mail-add')),
        remove: labelNames.describe(promptText('mail/tools-organize.label-mail-remove')),
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
        organized(
          'Labels changed',
          await this.change(call, await this.labelChange(call, context), context),
        ),
    });
  }

  private archiveMail(): BotToolDefinition {
    return defineBotTool({
      name: 'archive_mail',
      asks: true,
      scope: 'mail:write',
      description: promptText('mail/tools-organize.archive-mail', {
        mailOrganizeMax: String(MAIL_ORGANIZE_MAX),
      }),
      input: threadsOnly,
      normalize: (call, context) => this.frozen(call, context),
      summarize: async (call, context) =>
        `Archive ${targetCount(call)} in ${describeAccount(await this.connection(call, context))}`,
      run: async (call, context) =>
        organized('Archived', await this.change(call, ARCHIVE_CHANGE, context)),
    });
  }

  private trashMail(): BotToolDefinition {
    return defineBotTool({
      name: 'trash_mail',
      asks: 'always',
      scope: 'mail:write',
      description: promptText('mail/tools-organize.trash-mail', {
        mailOrganizeMax: String(MAIL_ORGANIZE_MAX),
      }),
      input: threadsOnly,
      normalize: (call, context) => this.frozen(call, context),
      summarize: async (call, context) =>
        `Move ${targetCount(call)} to Trash in ${describeAccount(await this.connection(call, context))} (Gmail empties Trash after 30 days)`,
      run: async (call, context) =>
        organized('Moved to Trash', await this.trash(call, true, context)),
    });
  }

  private untrashMail(): BotToolDefinition {
    return defineBotTool({
      name: 'untrash_mail',
      scope: 'mail:write',
      description: promptText('mail/tools-organize.untrash-mail', {
        mailOrganizeMax: String(MAIL_ORGANIZE_MAX),
      }),
      input: threadsOnly,
      run: async (call, context) =>
        organized('Brought back from Trash', await this.trash(call, false, context)),
    });
  }

  private createLabel(): BotToolDefinition {
    return defineBotTool({
      name: 'create_label',
      asks: true,
      scope: 'mail:write',
      description: promptText('mail/tools-organize.create-label'),
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
        promptText('mail/tools-organize.label-change', {
          missing: change.missing.map((name) => `"${name}"`).join(', '),
        }),
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

/** An organizing write's answer, carrying the limit that stopped it partway so the turn waits for it. */
function organized(done: string, outcome: GmailBulkOutcome): BotToolAnswer {
  return {
    content: `${done}: ${organizeAnswer(outcome, new Date())}`,
    ...(outcome.limited && { rateLimit: outcome.limited }),
  };
}

/** A label change that changes nothing is refused, before a card or a call. */
function assertChanges(change: MailLabelChange): void {
  if (change.add.length + change.remove.length === 0) {
    throw new BotToolRefusal(promptText('mail/tools-organize.assert-changes'));
  }
}

/** The change, once {@link assertChanges} holds. */
function changeOf<Change extends MailLabelChange>(change: Change): Change {
  assertChanges(change);
  return change;
}

/** Trash and its kin are refused by name or id, before any label is looked up. */
function assertNotReserved(added: readonly string[]): void {
  if (added.some((label) => RESERVED_ADD.has(label.trim().toUpperCase()))) {
    throw new BotToolRefusal(promptText('mail/tools-organize.assert-not-reserved'));
  }
}

function assertTargets(call: Targets): void {
  const count = call.thread_ids.length + (call.message_ids?.length ?? 0);
  if (count === 0)
    throw new BotToolRefusal(
      promptText('mail/tools-organize.assert-targets-name-threads-messages'),
    );
  if (count > MAIL_ORGANIZE_MAX) {
    throw new BotToolRefusal(
      promptText('mail/tools-organize.assert-targets-once-one-call', {
        count: String(count),
        mailOrganizeMax: String(MAIL_ORGANIZE_MAX),
      }),
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
