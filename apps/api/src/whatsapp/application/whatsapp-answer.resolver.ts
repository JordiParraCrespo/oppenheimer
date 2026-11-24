import { Inject, Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { SCOPE_RESOLVER, type ScopeResolverPort } from '@oppenheimer/backend-authz';
import type { BotEntity } from '../../bots/domain/bot.entity';
import { FindBotsQuery } from '../../bots/queries/find-bots/find-bots.query';
import type { WhatsappChatGrantRepositoryPort } from '../database/whatsapp-chat-grant.repository.port';
import type { WhatsappMessagesOwed } from '../database/whatsapp-message.repository.port';
import { WhatsappContactWroteDomainEvent } from '../domain/events/whatsapp-contact-wrote.domain-event';
import { WhatsappOwnerWroteDomainEvent } from '../domain/events/whatsapp-owner-wrote.domain-event';
import type { WhatsappAccountEntity } from '../domain/whatsapp-account.entity';
import {
  WHATSAPP_NEW_LINE,
  WHATSAPP_NO_BOT_LINE,
  WHATSAPP_STOP_LINE,
  type WhatsappOwnerCommand,
  whatsappContactAction,
  whatsappHelpLine,
  whatsappInboundAction,
  whatsappSwitchedLine,
} from '../domain/whatsapp-inbound.policy';
import type {
  WhatsappChatPlace,
  WhatsappMessageDraft,
  WhatsappStoredMessage,
} from '../domain/whatsapp-message.types';
import { WHATSAPP_CHAT_GRANT_REPOSITORY } from '../whatsapp.di-tokens';
import { WhatsappReplyResolver } from './whatsapp-reply.resolver';

/** What a message of a batch came to, once a "Name:" was matched against the owner's bots. */
export type WhatsappDecidedAction =
  | {
      kind: 'owner';
      command: WhatsappOwnerCommand;
      text: string;
      /** The bot a "Name: …" switched to; null when it named none, or several. */
      switchedTo: { id: string; name: string } | null;
      /** A voice note with no caption, heard when the bot is woken. */
      voiceNote: boolean;
    }
  /** Someone else, in a chat the number allows, spoke to it: `botId` answers. */
  | { kind: 'contact'; text: string; botId: string }
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
 * a bot's turn: the confirmed owner's, in their own chat, and, in a chat the
 * number allows, a contact's that speaks to it (`whatsappContactAction`),
 * which wakes the chat's bot and is answered by nothing else. A
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
    @Inject(WHATSAPP_CHAT_GRANT_REPOSITORY)
    private readonly grants: WhatsappChatGrantRepositoryPort,
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
    const answerFor = await this.contactBots(account, drafts, raw);
    const actions = new Map<string, WhatsappDecidedAction>();
    const decided = drafts.map((draft, index) => {
      const action = raw[index] ?? { kind: 'ignore' };
      if (action.kind !== 'owner') {
        actions.set(keyOf(draft), contactActionOf(account, draft, answerFor));
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
        voiceNote: action.voiceNote,
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
    if (!account.ownerPhone) return undefined;
    return {
      answeringBotId: account.answeringBotId,
      isOwners: (draft) => batch.actionOf(draft).kind === 'owner',
      contactEventFor: (message) => {
        const action = batch.actionOf(message);
        return action.kind === 'contact' ? contactEventOf(account, message, action) : null;
      },
      eventFor: (message, place) => {
        const action = batch.actionOf(message);
        if (action.kind !== 'owner' || action.command === 'help' || !place.botId) return null;
        if (action.command === 'message' && !action.text && !action.voiceNote) return null;
        return eventOf(
          account,
          message,
          place,
          place.botId,
          action.command,
          action.text,
          action.voiceNote,
          message.media === 'image',
        );
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

  /**
   * The bot that answers each chat of the batch the number allows: the one
   * chosen for it, else the number's default; a chat answered by none (no
   * choice and no default) is left out, so it is stored and wakes no one.
   * Read only when the batch holds a message that is not the owner's own.
   */
  private async contactBots(
    account: WhatsappAccountEntity,
    drafts: readonly WhatsappMessageDraft[],
    raw: readonly { kind: string }[],
  ): Promise<ReadonlyMap<string, string>> {
    const others = drafts.some((draft, index) => raw[index]?.kind !== 'owner' && !draft.fromMe);
    if (!others || !account.ownerPhone) return new Map();
    const grants = await this.grants.findAll({
      organizationId: account.organizationId,
      accountId: account.id,
    });
    return new Map(
      grants.flatMap((grant) => {
        const botId = grant.botId ?? account.answeringBotId;
        return botId ? [[grant.chatId, botId] as const] : [];
      }),
    );
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

/** What a message that is not the owner's own comes to, given who answers each allowed chat. */
function contactActionOf(
  account: WhatsappAccountEntity,
  draft: WhatsappMessageDraft,
  answerFor: ReadonlyMap<string, string>,
): WhatsappDecidedAction {
  const botId = answerFor.get(draft.chatId);
  const action = whatsappContactAction(account, botId !== undefined, draft);
  return action.kind === 'contact' && botId ? { ...action, botId } : { kind: 'ignore' };
}

/** A contact spoke to the number in a chat it allows: what wakes the chat's bot, staged with the message. */
function contactEventOf(
  account: WhatsappAccountEntity,
  message: WhatsappStoredMessage,
  action: Extract<WhatsappDecidedAction, { kind: 'contact' }>,
): WhatsappContactWroteDomainEvent {
  return new WhatsappContactWroteDomainEvent({
    aggregateId: account.id,
    reason: `someone wrote to WhatsApp number ${account.id} in a chat it allows, and bot ${action.botId} answers that chat`,
    organizationId: account.organizationId,
    userId: account.userId,
    accountId: account.id,
    chatId: message.chatId,
    chatKind: message.chatKind,
    chatName: message.chatName,
    senderId: message.senderId,
    senderName: message.senderName,
    messageRowId: message.id,
    seq: message.seq,
    botId: action.botId,
    text: action.text,
    image: message.media === 'image',
  });
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
  voiceNote: boolean,
  image: boolean,
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
    voiceNote,
    image,
  });
}
