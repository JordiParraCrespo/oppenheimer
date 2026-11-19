import { Inject, Injectable } from '@nestjs/common';
import { BOT_ATTENDED_ORIGINS, BOT_NOTICE_TEXT_MAX } from '@oppenheimer/shared';
import { z } from 'zod/v4';
import { BOT_NOTICE_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotNoticeRepositoryPort } from '../database/bot-notice.repository.port';
import { BotNoticeEntity } from '../domain/bot-notice.entity';
import {
  BOT_NOTICES_PER_TURN,
  noticeSent,
  noticesSpent,
  WORTH_SAYING,
} from '../domain/bot-notice.policy';
import { promptText } from '../domain/bot-prompt-text.policy';
import { QUIET_TOOL, quietTurnAnswer } from '../domain/bot-routine.policy';
import {
  type BotToolArea,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

const nothingToReportInput = z.object({
  checked: z
    .string()
    .trim()
    .max(200)
    .optional()
    .describe(promptText('tools/notice.nothing-to-report-checked')),
});

const notifyInput = z.object({
  text: z
    .string()
    .trim()
    .min(1)
    .max(BOT_NOTICE_TEXT_MAX)
    .describe(promptText('tools/notice.notify-text')),
});

/**
 * How a bot that works on its own tells the person something, or that there is
 * nothing to tell. `notify` is a line for the person's Inbox, the bot's `runner
 * sessions notify`: a reply shows only in the bot's chat, which the person may
 * not be watching. It asks nothing and reaches nothing outside Oppenheimer, so
 * it never asks first; a bot keeps one notice, its latest. `nothing_to_report`
 * is a turn nobody is waiting on (a heartbeat, a wake) ending quietly: a tool,
 * so it cannot be mistaken for prose, and never offered where a person waits
 * for an answer.
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
        description: promptText('tools/notice.notify', {
          worthSaying: WORTH_SAYING,
          noticeTextMax: String(BOT_NOTICE_TEXT_MAX),
          noticesPerTurn: String(BOT_NOTICES_PER_TURN),
        }),
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
      defineBotTool({
        name: QUIET_TOOL,
        scope: 'bots:read',
        notOn: BOT_ATTENDED_ORIGINS,
        description: promptText('tools/notice.quiet-tool'),
        input: nothingToReportInput,
        run: async () => quietTurnAnswer(),
      }),
    ];
  }
}
