import { Inject, Injectable } from '@nestjs/common';
import { BOT_NOTICE_TEXT_MAX } from '@oppenheimer/shared';
import { z } from 'zod/v4';
import { BOT_NOTICE_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotNoticeRepositoryPort } from '../database/bot-notice.repository.port';
import { BotNoticeEntity } from '../domain/bot-notice.entity';
import { BOT_NOTICES_PER_TURN, noticeSent, noticesSpent } from '../domain/bot-notice.policy';
import {
  type BotToolArea,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

const notifyInput = z.object({
  text: z
    .string()
    .trim()
    .min(1)
    .max(BOT_NOTICE_TEXT_MAX)
    .describe('One line for the person: what is done, or what you need from them.'),
});

/**
 * A line for the person's Inbox (`product/next-steps/agent-tools.md` §5), the
 * bot's `runner sessions notify`: a reply shows only in the bot's chat, which
 * the person may not be watching. It asks nothing and reaches nothing outside
 * Oppenheimer, so it never asks first; a bot keeps one notice, its latest.
 */
@Injectable()
export class BotNoticeToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'self' as const;

  constructor(@Inject(BOT_NOTICE_REPOSITORY) private readonly notices: BotNoticeRepositoryPort) {}

  definitions(): readonly BotToolDefinition[] {
    return [
      defineBotTool({
        name: 'notify',
        scope: 'bots:write',
        description: `Puts one line in the person's Inbox, where they see it whether or not they are in this chat. Use it when you finish something they asked to hear about, or when you need them and they may not be in your chat (a routine's run, a wake, a long task). One line, at most ${BOT_NOTICE_TEXT_MAX} characters: what is done or what you need, not a report. It replaces your previous notice. At most ${BOT_NOTICES_PER_TURN} a turn; not for what you are already saying to them in the chat.`,
        input: notifyInput,
        run: async (input, context) => {
          if (!context.budget.take('notify', BOT_NOTICES_PER_TURN)) {
            throw new BotToolRefusal(noticesSpent());
          }
          await this.notices.put(
            BotNoticeEntity.send({
              organizationId: context.organizationId,
              botId: context.botId,
              text: input.text,
            }),
          );
          return noticeSent();
        },
      }),
    ];
  }
}
