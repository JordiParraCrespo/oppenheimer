import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { z } from 'zod/v4';
import {
  FindWhatsappAccountsQuery,
  type WhatsappAccountView,
} from '../../whatsapp/queries/find-whatsapp-accounts/find-whatsapp-accounts.query';
import { describeWhatsappAccount, NO_WHATSAPP } from '../bot-whatsapp-tool.mapper';
import { promptText } from '../domain/bot-prompt-text.policy';
import { BotToolRefusal } from './bot-tool.factory';

/** The number a WhatsApp tool's call means, as the model names it. */
export const whatsappAccountInput = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .describe(promptText('tools/whatsapp.account'));

/** The chat a WhatsApp tool's call means, as the model names it. */
export const whatsappChatInput = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .describe(promptText('tools/whatsapp.chat'));

/**
 * Which of the owner's linked WhatsApp numbers a tool's call means: by its id
 * or its name, or the only one. A name that matches none is refused with the
 * numbers listed, so the bot can correct itself.
 */
@Injectable()
export class BotWhatsappAccountsResolver {
  constructor(private readonly queryBus: QueryBus) {}

  all(owner: AccessScope): Promise<WhatsappAccountView[]> {
    return this.queryBus.execute<FindWhatsappAccountsQuery, WhatsappAccountView[]>(
      new FindWhatsappAccountsQuery({ scope: owner }),
    );
  }

  /** One number by its id or name, ignoring case; the only one when none is named. */
  async one(owner: AccessScope, wanted: string | undefined): Promise<WhatsappAccountView> {
    const views = await this.all(owner);
    if (views.length === 0) throw new BotToolRefusal(NO_WHATSAPP);
    const listed = () =>
      views.map((view) => describeWhatsappAccount(view.account, view.hostOnline)).join('; ');
    if (!wanted) {
      if (views.length === 1 && views[0]) return views[0];
      throw new BotToolRefusal(
        promptText('tools/whatsapp.one-several-numbers-linked', { listed: listed() }),
      );
    }
    const needle = wanted.trim().toLowerCase();
    const found =
      views.find((view) => view.account.id === wanted.trim()) ??
      views.find((view) => view.account.label.toLowerCase() === needle);
    if (!found)
      throw new BotToolRefusal(
        promptText('tools/whatsapp.one-linked-number-numbers', { wanted, listed: listed() }),
      );
    return found;
  }
}
