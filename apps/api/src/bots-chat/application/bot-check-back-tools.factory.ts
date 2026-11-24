import { Inject, Injectable } from '@nestjs/common';
import { BOT_CHECK_BACK_ABOUT_MAX } from '@oppenheimer/shared';
import { z } from 'zod/v4';
import { BOT_CHECK_BACKS, BOT_MESSAGE_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotMessageRepositoryPort } from '../database/bot-message.repository.port';
import {
  BOT_CHECK_BACK_HORIZON_MS,
  BOT_CHECK_BACK_MAX_GAP_MINUTES,
  BOT_CHECK_BACK_MINUTES,
  type CheckBackChain,
  checkBackBackoffText,
  checkBackChainOf,
  planCheckBack,
} from '../domain/bot-check-back.policy';
import { promptText } from '../domain/bot-prompt-text.policy';
import { formatToolTime } from '../domain/bot-tool-text.policy';
import type { BotCheckBacksPort } from '../infrastructure/bot-check-backs.port';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

const HORIZON_HOURS = String(BOT_CHECK_BACK_HORIZON_MS / 3_600_000);

/**
 * `check_back`: the bot asks to be woken later to look at anything it
 * delegated or waits on, as Claude Code's ScheduleWakeup does
 * (`27-bot-subscriptions.md` §7.3). It does not ask: it only wakes the bot,
 * with a turn as narrow as the one that called it, one look a turn, its
 * looks backing off and a chain of them ending after a day
 * (`bot-check-back.policy.ts`). A call in a look's own turn goes on with
 * that look's chain; any other starts one.
 */
@Injectable()
export class BotCheckBackToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'self' as const;

  constructor(
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    @Inject(BOT_CHECK_BACKS) private readonly checkBacks: BotCheckBacksPort,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.checkBack()];
  }

  /** The chain of the look whose turn this is; null for a turn that is no look. */
  private async chainOf(context: BotToolCallContext): Promise<CheckBackChain | null> {
    if (context.origin !== 'check_back') return null;
    const opening = await this.messages.findOpening(context.organizationId, context.turnId);
    return checkBackChainOf(opening?.event);
  }

  private checkBack(): BotToolDefinition {
    return defineBotTool({
      name: 'check_back',
      scope: 'bots:write',
      // A look turn is its own origin and lane, so a turn denied tools by why it
      // exists would hand its look what it was denied: a GitHub ask's look could
      // comment again in the owner's name, and a goal's could renew the goal.
      notOn: ['github', 'goal'],
      description: promptText('tools/check-back.check-back', {
        backoff: checkBackBackoffText(),
        maxGapMinutes: String(BOT_CHECK_BACK_MAX_GAP_MINUTES),
        horizonHours: HORIZON_HOURS,
      }),
      input: z.object({
        about: z
          .string()
          .trim()
          .min(1)
          .max(BOT_CHECK_BACK_ABOUT_MAX)
          .describe(promptText('tools/check-back.check-back-about')),
        minutes: z
          .number()
          .int()
          .min(BOT_CHECK_BACK_MINUTES.min)
          .max(BOT_CHECK_BACK_MINUTES.max)
          .optional()
          .describe(promptText('tools/check-back.check-back-minutes')),
      }),
      run: async (input, context) => {
        // A look starts a turn with no bot chain, so one set on a turn another
        // bot asked would slip the chain's depth, budget and cycle limits.
        if (context.lane === 'bots') {
          throw new BotToolRefusal(promptText('tools/check-back.check-back-not-for-bots'));
        }
        const now = new Date();
        const plan = planCheckBack(input, await this.chainOf(context), context.turnId, now);
        if (plan.kind === 'past_horizon') {
          throw new BotToolRefusal(
            promptText('tools/check-back.check-back-past-horizon', {
              startedAt: formatToolTime(plan.chainStartedAt, context.timeZone),
              at: formatToolTime(plan.at, context.timeZone),
              horizonHours: HORIZON_HOURS,
            }),
          );
        }
        const { look } = plan;
        const at = formatToolTime(look.at, context.timeZone);
        const earlier = context.budget.once('check_back', at);
        if (earlier !== null) {
          return promptText('tools/check-back.check-back-already-set', { at: earlier });
        }
        await this.checkBacks.schedule(
          {
            chainId: look.chainId,
            step: look.step,
            chainStartedAt: look.chainStartedAt,
            about: look.about,
            at: look.at,
            botId: context.botId,
            organizationId: context.organizationId,
            originTurnId: context.turnId,
            credentialScopes: context.credentialScopes,
            timeZone: context.timeZone,
          },
          null,
        );
        return promptText('tools/check-back.check-back-set', { at, look: String(look.step + 1) });
      },
    });
  }
}
