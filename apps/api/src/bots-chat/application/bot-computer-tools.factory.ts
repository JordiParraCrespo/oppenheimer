import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  COMPUTER_ACTIONS,
  COMPUTER_KEY_PATTERN,
  COMPUTER_KEYS_MAX,
  COMPUTER_SCREEN_MAX_EDGE,
  COMPUTER_SCROLL_MAX,
  COMPUTER_TEXT_MAX,
  COMPUTER_WAIT_MAX_SECONDS,
} from '@oppenheimer/shared/protocol';
import { z } from 'zod/v4';
import type { HostComputerOutcome } from '../../sessions/application/host-computer.port';
import { UseHostComputerCommand } from '../../sessions/commands/use-host-computer/use-host-computer.command';
import { toHostComputerRequest } from '../bot-computer-tool.mapper';
import { promptText } from '../domain/bot-prompt-text.policy';
import {
  computerCallProblem,
  computerCommandIdOf,
  computerSummary,
  describeComputer,
} from './bot-computer.policy';
import { BotHostTargetResolver } from './bot-host-target.resolver';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

const coordinate = (what: string) =>
  z
    .number()
    .int()
    .min(0)
    .max(COMPUTER_SCREEN_MAX_EDGE)
    .optional()
    .describe(promptText('computer/tools.use-computer-coordinate', { what }));

const scroll = (what: string) =>
  z.number().int().min(-COMPUTER_SCROLL_MAX).max(COMPUTER_SCROLL_MAX).optional().describe(what);

/**
 * Using a computer (`25-bots.md` §4.2, "Using a computer"): a bot sees the
 * screen of one of the owner's hosts and uses its mouse and keyboard, one
 * action at a time, each answered with the screen after it. It reaches
 * outside Oppenheimer, so under Auto it asks first, once per host
 * when the owner answers "always"; and whatever the bot's permissions say,
 * the host acts only when the person on it ran `runner computer on`.
 */
@Injectable()
export class BotComputerToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists the tool. */
  readonly group = 'sessions' as const;

  constructor(
    private readonly commandBus: CommandBus,
    private readonly hosts: BotHostTargetResolver,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.useComputer()];
  }

  private useComputer(): BotToolDefinition {
    return defineBotTool({
      name: 'use_computer',
      scope: 'sessions:write',
      asks: true,
      description: promptText('computer/tools.use-computer'),
      input: z.object({
        action: z.enum(COMPUTER_ACTIONS).describe(promptText('computer/tools.use-computer-action')),
        x: coordinate('Where to act, across'),
        y: coordinate('Where to act, down'),
        to_x: coordinate('Where a drag ends, across'),
        to_y: coordinate('Where a drag ends, down'),
        scroll_y: scroll(promptText('computer/tools.use-computer-scroll-y')),
        scroll_x: scroll(promptText('computer/tools.use-computer-scroll-x')),
        text: z
          .string()
          .min(1)
          .max(COMPUTER_TEXT_MAX)
          .optional()
          .describe(promptText('computer/tools.use-computer-text')),
        keys: z
          .array(z.string().regex(COMPUTER_KEY_PATTERN))
          .min(1)
          .max(COMPUTER_KEYS_MAX)
          .optional()
          .describe(promptText('computer/tools.use-computer-keys')),
        seconds: z
          .number()
          .int()
          .min(0)
          .max(COMPUTER_WAIT_MAX_SECONDS)
          .optional()
          .describe(
            promptText('computer/tools.use-computer-seconds', {
              maxSeconds: String(COMPUTER_WAIT_MAX_SECONDS),
            }),
          ),
        host_id: z.uuid().optional().describe(promptText('computer/tools.use-computer-host-id')),
      }),
      normalize: async (input, context) => {
        this.refuseUnusable(input, context);
        return { ...input, host_id: await this.hosts.usable(input, context) };
      },
      // One subject per host: "always" on a card lets every later step on
      // that screen run, where a card per click would make the tool useless.
      subject: async (input, context) => {
        const hostId = this.hosts.idOf(input, context);
        return {
          kind: 'host_screen',
          key: hostId,
          label: `the screen of ${await this.hosts.name(context, hostId)}`,
        };
      },
      summarize: async (input, context) =>
        computerSummary(input, await this.hosts.name(context, this.hosts.idOf(input, context))),
      run: async (input, context) => {
        const approved = context.approvalId !== undefined;
        // An approved call is carried out after its turn: no model is reading.
        if (!approved) this.refuseUnusable(input, context);
        const hostId = this.hosts.idOf(input, context);
        const outcome = await this.commandBus.execute<UseHostComputerCommand, HostComputerOutcome>(
          new UseHostComputerCommand({
            scope: context.owner,
            hostId,
            ...(context.approvalId ? { commandId: computerCommandIdOf(context.approvalId) } : {}),
            request: toHostComputerRequest(input),
          }),
        );
        const shown = outcome.kind === 'screen' && !approved;
        const content = describeComputer(outcome, await this.hosts.name(context, hostId), shown);
        return shown
          ? { content, modelImages: [{ mimeType: 'image/jpeg', data: outcome.screen.image }] }
          : content;
      },
    });
  }

  /** Refuses before any card: a model with no eyes, or an action missing a part. */
  private refuseUnusable(
    input: Parameters<typeof computerCallProblem>[0],
    context: BotToolCallContext,
  ): void {
    if (!context.seesImages) throw new BotToolRefusal(promptText('computer/tools.needs-eyes'));
    const problem = computerCallProblem(input);
    if (problem) throw new BotToolRefusal(problem);
  }
}
