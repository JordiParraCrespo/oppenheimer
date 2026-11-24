import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { AccessScope } from '@oppenheimer/backend-authz';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { z } from 'zod/v4';
import type { BotEntity } from '../../bots/domain/bot.entity';
import { FindBotsQuery } from '../../bots/queries/find-bots/find-bots.query';
import { AllowWhatsappChatCommand } from '../../whatsapp/commands/allow-whatsapp-chat/allow-whatsapp-chat.command';
import { RevokeWhatsappChatCommand } from '../../whatsapp/commands/revoke-whatsapp-chat/revoke-whatsapp-chat.command';
import type { WhatsappChatGrantEntity } from '../../whatsapp/domain/whatsapp-chat-grant.entity';
import { FindWhatsappChatGrantsQuery } from '../../whatsapp/queries/find-whatsapp-chat-grants/find-whatsapp-chat-grants.query';
import {
  describeWhatsappAccount,
  describeWhatsappGrant,
  describeWhatsappTarget,
  fenceWhatsapp,
  WHATSAPP_UNTRUSTED_NOTE,
  whatsappTargetOfGrant,
} from '../bot-whatsapp-tool.mapper';
import { promptText } from '../domain/bot-prompt-text.policy';
import {
  type BotToolArea,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';
import {
  whatsappAccountInput as account,
  BotWhatsappAccountsResolver,
  whatsappChatInput as chat,
} from './bot-whatsapp-accounts.resolver';

/**
 * The turns offered the tools that change who may talk on a number: the
 * owner's console chat with the bot, and the owner's own chat with the
 * number. Never a group's or a contact's turn, nor one nobody is waiting on.
 */
const OWNER_CHAT_ORIGINS = ['message', 'whatsapp'] as const;

/** What `allow_whatsapp_chat` takes for the number's default bot. */
const DEFAULT_BOT = 'default';

/**
 * Who may talk to the owner's bots on their WhatsApp numbers besides them:
 * the groups and people each number allows, and the bot that answers each.
 * Listing is open to the owner's turns; allowing and revoking only to the
 * owner's own (`ownerOnlyOn`), so nothing someone else wrote allows a chat.
 */
@Injectable()
export class BotWhatsappGrantToolsFactory implements BotToolArea {
  readonly group = 'whatsapp' as const;

  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    private readonly accounts: BotWhatsappAccountsResolver,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.listAllowed(), this.allow(), this.revoke()];
  }

  private listAllowed(): BotToolDefinition {
    return defineBotTool({
      name: 'list_whatsapp_allowed_chats',
      readOnly: true,
      scope: 'whatsapp:read',
      description: promptText('whatsapp/tools-grants.list-whatsapp-allowed-chats'),
      input: z.object({ account: account.optional() }),
      run: async (input, context) => {
        const chosen = await this.accounts.one(context.owner, input.account);
        const grants = await this.grants(context.owner, chosen.account.id);
        const header = describeWhatsappAccount(chosen.account, chosen.hostOnline);
        if (grants.length === 0)
          return promptText('whatsapp/tools-grants.list-whatsapp-allowed-chats-none', { header });
        const names = await this.botNames(context.owner);
        return [
          `${header}, ${grants.length} allowed chat(s). ${WHATSAPP_UNTRUSTED_NOTE}`,
          fenceWhatsapp(grants.map((grant) => describeWhatsappGrant(grant, names)).join('\n')),
        ].join('\n');
      },
    });
  }

  private allow(): BotToolDefinition {
    return defineBotTool({
      name: 'allow_whatsapp_chat',
      scope: 'whatsapp:write',
      ownerOnlyOn: OWNER_CHAT_ORIGINS,
      description: promptText('whatsapp/tools-grants.allow-whatsapp-chat'),
      input: z.object({
        account: account.optional(),
        chat,
        bot: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .optional()
          .describe(
            promptText('whatsapp/tools-grants.allow-whatsapp-chat-bot', {
              defaultBot: DEFAULT_BOT,
            }),
          ),
      }),
      run: async (input, context) => {
        const chosen = await this.accounts.one(context.owner, input.account);
        const botId = await this.botIdOf(context.owner, input.bot);
        const grantId = await this.commandBus.execute<AllowWhatsappChatCommand, AggregateID>(
          new AllowWhatsappChatCommand({
            scope: context.owner,
            accountId: chosen.account.id,
            chat: input.chat,
            botId,
            grantedByBotId: context.botId,
          }),
        );
        const grant = (await this.grants(context.owner, chosen.account.id)).find(
          (item) => item.id === grantId,
        );
        if (!grant)
          throw new BotToolRefusal(
            promptText('whatsapp/tools-grants.allow-whatsapp-chat-not-read-back'),
          );
        const names = await this.botNames(context.owner);
        return `Allowed on "${chosen.account.label}": ${describeWhatsappGrant(grant, names)}.`;
      },
    });
  }

  private revoke(): BotToolDefinition {
    return defineBotTool({
      name: 'revoke_whatsapp_chat',
      scope: 'whatsapp:write',
      ownerOnlyOn: OWNER_CHAT_ORIGINS,
      description: promptText('whatsapp/tools-grants.revoke-whatsapp-chat'),
      input: z.object({ account: account.optional(), chat }),
      run: async (input, context) => {
        const chosen = await this.accounts.one(context.owner, input.account);
        const grants = await this.grants(context.owner, chosen.account.id);
        const grant = pickGrant(grants, input.chat);
        await this.commandBus.execute(
          new RevokeWhatsappChatCommand({
            scope: context.owner,
            accountId: chosen.account.id,
            grantId: grant.id,
          }),
        );
        return promptText('whatsapp/tools-grants.revoke-whatsapp-chat-answer', {
          label: chosen.account.label,
          chat: describeWhatsappTarget(whatsappTargetOfGrant(grant)),
        });
      },
    });
  }

  private grants(owner: AccessScope, accountId: string): Promise<WhatsappChatGrantEntity[]> {
    return this.queryBus.execute<FindWhatsappChatGrantsQuery, WhatsappChatGrantEntity[]>(
      new FindWhatsappChatGrantsQuery({ scope: owner, accountId }),
    );
  }

  /** The bots the person made in this workspace: only those answer on their numbers. */
  private async ownBots(owner: AccessScope): Promise<BotEntity[]> {
    const bots = await this.queryBus.execute<FindBotsQuery, BotEntity[]>(
      new FindBotsQuery({ scope: owner }),
    );
    return bots.filter((bot) => bot.createdByUserId === owner.userId);
  }

  private async botNames(owner: AccessScope): Promise<ReadonlyMap<string, string>> {
    return new Map((await this.ownBots(owner)).map((bot) => [bot.id, bot.name]));
  }

  /** The bot a call named: undefined when none, null for the number's default, else its id. */
  private async botIdOf(owner: AccessScope, wanted: string | undefined) {
    if (!wanted) return undefined;
    if (wanted.trim().toLowerCase() === DEFAULT_BOT) return null;
    return (await this.ownBot(owner, wanted)).id;
  }

  /** One of the person's bots by its id or name, ignoring case. */
  private async ownBot(owner: AccessScope, wanted: string): Promise<BotEntity> {
    const bots = await this.ownBots(owner);
    const needle = wanted.trim().toLowerCase();
    const byId = bots.find((bot) => bot.id === wanted.trim());
    if (byId) return byId;
    const named = bots.filter((bot) => bot.name.trim().toLowerCase() === needle);
    if (named.length === 1 && named[0]) return named[0];
    const listed = bots.map((bot) => `"${bot.name}"`).join(', ') || 'none';
    throw new BotToolRefusal(
      named.length > 1
        ? promptText('whatsapp/tools-grants.bot-name-ambiguous', { wanted })
        : promptText('whatsapp/tools-grants.bot-not-found', { wanted, listed }),
    );
  }
}

/** An allowed chat by its chat id or its name, ignoring case. */
function pickGrant(
  grants: readonly WhatsappChatGrantEntity[],
  wanted: string,
): WhatsappChatGrantEntity {
  const needle = wanted.trim().toLowerCase();
  const byId = grants.find((grant) => grant.chatId === wanted.trim());
  if (byId) return byId;
  const named = grants.filter((grant) => grant.chatName?.trim().toLowerCase() === needle);
  if (named.length === 1 && named[0]) return named[0];
  if (named.length > 1)
    throw new BotToolRefusal(promptText('whatsapp/tools-grants.chat-name-ambiguous', { wanted }));
  throw new BotToolRefusal(promptText('whatsapp/tools-grants.chat-not-allowed', { wanted }));
}
