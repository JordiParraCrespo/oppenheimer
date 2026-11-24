import { Inject, Injectable } from '@nestjs/common';
import { BOT_LOOP_SELF_PACED_MAX_MINUTES } from '@oppenheimer/shared';
import { z } from 'zod/v4';
import { BOT_LOOP_REPOSITORY, BOT_TURN_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotLoopRepositoryPort } from '../database/bot-loop.repository.port';
import type { BotTurnRepositoryPort } from '../database/bot-turn.repository.port';
import type { BotLoopEntity } from '../domain/bot-loop.entity';
import { mayActOnLoop, selfPacedRunAt } from '../domain/bot-loop.policy';
import { promptText } from '../domain/bot-prompt-text.policy';
import { BotLoopResolver } from './bot-loop.resolver';
import { type BotToolArea, type BotToolDefinition, defineBotTool } from './bot-tool.factory';

/**
 * A loop the person set with `/loop`: the bot says when
 * a self-paced one runs next, and ends one that has served its purpose.
 * Neither asks: the person set the loop, its spend is bounded by its
 * interval and its 3 days, every run is a line in the chat, and Stop is one
 * click. A bot cannot set a loop: only the person's `/loop` does. A run of a
 * loop the person replaced acts on nothing: the loop the bot has now is not
 * the one it ran for (`mayActOnLoop`).
 */
@Injectable()
export class BotLoopToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'self' as const;

  constructor(
    @Inject(BOT_LOOP_REPOSITORY) private readonly loops: BotLoopRepositoryPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    private readonly loopsOf: BotLoopResolver,
  ) {}

  /** The bot's loop, when the calling turn may act on it; null otherwise. */
  private async loopFor(context: {
    organizationId: string;
    botId: string;
    turnId: string;
  }): Promise<BotLoopEntity | null> {
    const loop = await this.loops.findForBot(context.organizationId, context.botId);
    if (!loop) return null;
    const turn = await this.turns.findForRun(context.turnId);
    return turn.isSome() && mayActOnLoop(loop, turn.unwrap()) ? loop : null;
  }

  definitions(): readonly BotToolDefinition[] {
    return [this.scheduleLoop(), this.endLoop()];
  }

  private scheduleLoop(): BotToolDefinition {
    return defineBotTool({
      name: 'schedule_loop',
      scope: 'bots:write',
      description: promptText('routines/tools-loop.schedule-loop', {
        loopSelfPacedMaxMinutes: String(BOT_LOOP_SELF_PACED_MAX_MINUTES),
      }),
      input: z.object({
        minutes: z
          .number()
          .int()
          .min(1)
          .max(BOT_LOOP_SELF_PACED_MAX_MINUTES)
          .describe(promptText('routines/tools-loop.schedule-loop-minutes')),
      }),
      run: async (input, context) => {
        const loop = await this.loopFor(context);
        if (!loop) return promptText('routines/tools-loop.schedule-loop-have-loop-schedule');
        if (!loop.selfPaced) {
          return promptText('routines/tools-loop.schedule-loop-loop-runs-every', {
            intervalMinutes: String(loop.intervalMinutes),
          });
        }
        const at = selfPacedRunAt(loop, input.minutes, new Date());
        if (!(await this.loops.schedule(loop, at, null))) {
          return promptText('routines/tools-loop.schedule-loop-loop-ended-moved');
        }
        return `Your loop runs next at ${at.toISOString()}.`;
      },
    });
  }

  private endLoop(): BotToolDefinition {
    return defineBotTool({
      name: 'end_loop',
      scope: 'bots:write',
      description: promptText('routines/tools-loop.end-loop'),
      input: z.object({}),
      run: async (_input, context) => {
        const loop = await this.loopFor(context);
        if (!loop) return 'You have no loop to end.';
        // No line: the call is the record, in this turn's activity.
        await this.loopsOf.end(loop, null, null);
        return `Loop ended after ${loop.runs + 1} runs: ${loop.prompt}`;
      },
    });
  }
}
