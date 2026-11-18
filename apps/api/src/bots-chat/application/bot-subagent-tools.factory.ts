import { Injectable } from '@nestjs/common';
import { z } from 'zod/v4';
import { promptText } from '../domain/bot-prompt-text.policy';
import {
  SUBAGENT_CALLS_PER_TURN,
  SUBAGENT_CONCURRENCY,
  SUBAGENT_TASK_MAX,
  SUBAGENT_TASKS_MAX,
  SUBAGENT_TIME_LIMIT_MS,
  subagentReport,
} from '../domain/bot-subagent.policy';
import {
  type BotToolArea,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

/**
 * Work: `delegate`, the bot's own subagents. It splits a
 * job into independent tasks, each run by a child inside this turn with the
 * turn's read-only tools, and reads back what each found, to answer the
 * person itself. A child is offered no `delegate`, so delegation is one
 * level deep; it is not a bot, has no conversation and leaves nothing behind
 * but its line in the chat.
 */
@Injectable()
export class BotSubagentToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'web' as const;

  definitions(): readonly BotToolDefinition[] {
    return [
      defineBotTool({
        name: 'delegate',
        scope: 'bots:write',
        description: promptText('tools/subagents.delegate', {
          subagentTasksMax: String(SUBAGENT_TASKS_MAX),
          subagentTimeLimitSeconds: String(SUBAGENT_TIME_LIMIT_MS / 1_000),
          subagentConcurrency: String(SUBAGENT_CONCURRENCY),
          subagentCallsPerTurn: String(SUBAGENT_CALLS_PER_TURN),
        }),
        input: z.object({
          tasks: z
            .array(
              z.object({
                task: z
                  .string()
                  .trim()
                  .min(1)
                  .max(SUBAGENT_TASK_MAX)
                  .describe(promptText('tools/subagents.delegate-tasks-task')),
                context: z
                  .string()
                  .max(SUBAGENT_TASK_MAX)
                  .optional()
                  .describe(promptText('tools/subagents.delegate-tasks-context')),
              }),
            )
            .min(1)
            .max(SUBAGENT_TASKS_MAX),
        }),
        run: async (input, context, signal) => {
          if (!context.subagents) {
            throw new BotToolRefusal(
              promptText('tools/subagents.delegate-refused-subagents-cannot'),
            );
          }
          if (!context.budget.take('delegate', SUBAGENT_CALLS_PER_TURN)) {
            throw new BotToolRefusal(
              promptText('tools/subagents.delegate-refused-turn-has', {
                subagentCallsPerTurn: String(SUBAGENT_CALLS_PER_TURN),
              }),
            );
          }
          const subagents = await context.subagents.run(input.tasks, signal, context.callId);
          return { content: subagentReport(subagents), subagents };
        },
      }),
    ];
  }
}
