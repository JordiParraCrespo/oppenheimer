import { Inject, Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { SCOPE_RESOLVER, type ScopeResolverPort } from '@oppenheimer/backend-authz';
import type { BotEntity } from '../../bots/domain/bot.entity';
import { FindBotsQuery } from '../../bots/queries/find-bots/find-bots.query';
import type { WhatsappMessagesOwed } from '../database/whatsapp-message.repository.port';
import { WhatsappOwnerWroteDomainEvent } from '../domain/events/whatsapp-owner-wrote.domain-event';
import type { WhatsappAccountEntity } from '../domain/whatsapp-account.entity';
import {
  WHATSAPP_NEW_LINE,
  WHATSAPP_NO_BOT_LINE,
  WHATSAPP_STOP_LINE,
  type WhatsappOwnerCommand,
  whatsappHelpLine,
  whatsappInboundAction,
  whatsappSwitchedLine,
} from '../domain/whatsapp-inbound.policy';
import type {
  WhatsappChatPlace,
  WhatsappMessageDraft,
  WhatsappStoredMessage,
} from '../domain/whatsapp-message.types';
import { WhatsappReplyResolver } from './whatsapp-reply.resolver';

/** What a message of a batch came to, once a "Name:" was matched against the owner's bots. */
export type WhatsappDecidedAction =
  | {
      kind: 'owner';
      command: WhatsappOwnerCommand;
      text: string;
      /** The bot a "Name: …" switched to; null when it named none, or several. */
      switchedTo: { id: string; name: string } | null;
    }
  | { kind: 'ignore' };

/** A batch as intake stores it: the drafts (switches resolved) and what each came to. */
export interface WhatsappDecidedBatch {
  drafts: WhatsappMessageDraft[];
  actionOf: (message: Pick<WhatsappMessageDraft, 'chatId' | 'externalId'>) => WhatsappDecidedAction;
  /** The owner's bots by id, read when a line has to name one. */
  botNames: ReadonlyMap<string, string>;
}

/**
 * What new messages to a linked number come to, and are answered with besides
 * a bot's turn (`product/next-steps/answering-on-telegram-and-whatsapp.md`
 * §2): only the confirmed owner's, in their own chat, come to anything. A
 * "Name: …" switches the chat to the one bot of the owner's with that name
 * (ignoring case), resolved now so a later rename changes nothing; a name
 * that is no bot's, or several bots', leaves the message as written. The
 * owner's `/help`, `/new`, `/stop`, a bare "Name:" and a message while no
 * bot answers get a fixed line, quoting what they answer.
 */
@Injectable()
export class WhatsappAnswerResolver {
  constructor(
    private readonly queryBus: QueryBus,
    @Inject(SCOPE_RESOLVER) private readonly scopes: ScopeResolverPort,
    private readonly replies: WhatsappReplyResolver,
  ) {}

  async decide(
    account: WhatsappAccountEntity,
    drafts: readonly WhatsappMessageDraft[],
  ): Promise<WhatsappDecidedBatch> {
    const raw = drafts.map((draft) => whatsappInboundAction(account, draft));
    const needsBots = raw.some(
      (action) => action.kind === 'owner' && (action.switchName || action.command === 'help'),
    );
    const bots = needsBots ? await this.ownBots(account) : [];
    const actions = new Map<string, WhatsappDecidedAction>();
    const decided = drafts.map((draft, index) => {
      const action = raw[index] ?? { kind: 'ignore' };
      if (action.kind !== 'owner') {
        actions.set(keyOf(draft), action);
        return draft;
      }
      const wanted = action.switchName?.toLowerCase();
      const named = wanted ? bots.filter((bot) => bot.name.trim().toLowerCase() === wanted) : [];
      const bot = named.length === 1 ? named[0] : undefined;
      actions.set(keyOf(draft), {
        kind: 'owner',
        command: action.command,
        text: bot || !action.switchName ? action.text : draft.text.trim(),
        switchedTo: bot ? { id: bot.id, name: bot.name } : null,
      });
      return bot ? { ...draft, switchesToBotId: bot.id } : draft;
    });
    return {
      drafts: decided,
      actionOf: (message) => actions.get(keyOf(message)) ?? { kind: 'ignore' },
      botNames: new Map(bots.map((bot) => [bot.id, bot.name])),
    };
  }

  /**
   * What the batch owes once stored: each owner's message is placed in their
   * chat, and one that asks the chat's bot something (a message with words,
   * `/new`, `/stop`) stages the event that wakes it. Nothing while no owner
   * is confirmed.
   */
  owed(
    account: WhatsappAccountEntity,
    batch: WhatsappDecidedBatch,
  ): WhatsappMessagesOwed | undefined {
    const ownerPhone = account.ownerPhone;
    if (!ownerPhone) return undefined;
    return {
      ownerPhone,
      answeringBotId: account.answeringBotId,
      isOwners: (draft) => batch.actionOf(draft).kind === 'owner',
      eventFor: (message, place) => {
        const action = batch.actionOf(message);
        if (action.kind !== 'owner' || action.command === 'help' || !place.botId) return null;
        if (action.command === 'message' && !action.text) return null;
        return eventOf(account, message, place, place.botId, action.command, action.text);
      },
    };
  }

  /** The fixed lines the new messages are owed, in the order they came. */
  async answer(
    account: WhatsappAccountEntity,
    stored: readonly WhatsappStoredMessage[],
    batch: WhatsappDecidedBatch,
  ): Promise<void> {
    for (const message of stored) {
      const action = batch.actionOf(message);
      if (action.kind !== 'owner' || !message.place) continue;
      const line = fixedLineOf(action, message.place, batch.botNames);
      if (!line) continue;
      await this.replies.send(
        account,
        { chatId: message.chatId, quote: { id: message.externalId, senderId: message.senderId } },
        line,
        null,
      );
    }
  }

  /** The bots the number's owner made in its workspace, read as the owner. */
  private async ownBots(account: WhatsappAccountEntity): Promise<BotEntity[]> {
    const scope = await this.scopes.resolve({
      userId: account.userId,
      organizationId: account.organizationId,
      isPlatformAdmin: false,
      hasFullAccess: false,
    });
    const bots = await this.queryBus.execute<FindBotsQuery, BotEntity[]>(
      new FindBotsQuery({ scope }),
    );
    return bots.filter((bot) => bot.createdByUserId === account.userId);
  }
}

function keyOf(message: Pick<WhatsappMessageDraft, 'chatId' | 'externalId'>): string {
  return `${message.chatId}/${message.externalId}`;
}

/** The line an owner's message is answered with by Oppenheimer itself, if any. */
function fixedLineOf(
  action: Extract<WhatsappDecidedAction, { kind: 'owner' }>,
  place: WhatsappChatPlace,
  botNames: ReadonlyMap<string, string>,
): string | null {
  if (action.command === 'help') {
    return whatsappHelpLine(place.botId ? (botNames.get(place.botId) ?? null) : null);
  }
  if (!place.botId) return WHATSAPP_NO_BOT_LINE;
  if (action.command === 'new') return WHATSAPP_NEW_LINE;
  if (action.command === 'stop') return WHATSAPP_STOP_LINE;
  if (action.switchedTo && !action.text) return whatsappSwitchedLine(action.switchedTo.name);
  return null;
}

/** The owner wrote to the chat's bot: what wakes it, staged with the message. */
function eventOf(
  account: WhatsappAccountEntity,
  message: WhatsappStoredMessage,
  place: WhatsappChatPlace,
  botId: string,
  command: 'message' | 'new' | 'stop',
  text: string,
): WhatsappOwnerWroteDomainEvent {
  return new WhatsappOwnerWroteDomainEvent({
    aggregateId: account.id,
    reason: `the owner of WhatsApp number ${account.id} wrote to it (${command}) and bot ${botId} answers that chat`,
    organizationId: account.organizationId,
    userId: account.userId,
    accountId: account.id,
    chatId: message.chatId,
    messageRowId: message.id,
    seq: message.seq,
    botId,
    conversationStartsAt: place.startsAt,
    startsHere: place.startsAt === message.seq,
    command,
    text,
  });
}
