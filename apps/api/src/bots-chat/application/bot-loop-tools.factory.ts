import { Inject, Injectable } from '@nestjs/common';
import { BOT_LOOP_SELF_PACED_MAX_MINUTES } from '@oppenheimer/shared';
import { z } from 'zod/v4';
import { BOT_LOOP_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotLoopRepositoryPort } from '../database/bot-loop.repository.port';
import { selfPacedRunAt } from '../domain/bot-loop.policy';
import { BotLoopResolver } from './bot-loop.resolver';
import { type BotToolArea, type BotToolDefinition, defineBotTool } from './bot-tool.factory';

/**
 * A loop the person set with `/loop` (`25-bots.md` §4.1): the bot says when
 * a self-paced one runs next, and ends one that has served its purpose.
 * Neither asks: the person set the loop, its spend is bounded by its
 * interval and its 3 days, every run is a line in the chat, and Stop is one
 * click. A bot cannot set a loop: only the person's `/loop` does.
 */
@Injectable()
export class BotLoopToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'self' as const;

  constructor(
    @Inject(BOT_LOOP_REPOSITORY) private readonly loops: BotLoopRepositoryPort,
    private readonly loopsOf: BotLoopResolver,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.scheduleLoop(), this.endLoop()];
  }

  private scheduleLoop(): BotToolDefinition {
    return defineBotTool({
      name: 'schedule_loop',
      scope: 'bots:write',
      description: `Says when your self-paced loop (set with /loop and no interval) runs next: 1 to ${BOT_LOOP_SELF_PACED_MAX_MINUTES} minutes from now. Sooner while what you watch is changing, later when it is quiet. Call it once per run; if a run does not call it, the loop ends. A loop on a fixed interval keeps its own time.`,
      input: z.object({
        minutes: z
          .number()
          .int()
          .min(1)
          .max(BOT_LOOP_SELF_PACED_MAX_MINUTES)
          .describe('How many minutes from now the next run is due.'),
      }),
      run: async (input, context) => {
        const loop = await this.loops.findForBot(context.organizationId, context.botId);
        if (!loop) return 'You have no loop to schedule.';
        if (!loop.selfPaced) {
          return `Your loop runs every ${loop.intervalMinutes} minutes on its own; there is nothing to schedule.`;
        }
        const at = selfPacedRunAt(loop, input.minutes, new Date());
        if (!(await this.loops.schedule(loop, at, null))) {
          return 'Your loop ended or moved on before it could be scheduled.';
        }
        return `Your loop runs next at ${at.toISOString()}.`;
      },
    });
  }

  private endLoop(): BotToolDefinition {
    return defineBotTool({
      name: 'end_loop',
      scope: 'bots:write',
      description:
        'Ends your loop (set with /loop): it has served its purpose, what it watches finished, or it cannot go on without the person. No more runs come. Say why in your reply.',
      input: z.object({}),
      run: async (_input, context) => {
        const loop = await this.loops.findForBot(context.organizationId, context.botId);
        if (!loop) return 'You have no loop to end.';
        // No line: the call is the record, in this turn's activity.
        await this.loopsOf.end(loop, null, null);
        return `Loop ended after ${loop.runs + 1} runs: ${loop.prompt}`;
      },
    });
  }
}
