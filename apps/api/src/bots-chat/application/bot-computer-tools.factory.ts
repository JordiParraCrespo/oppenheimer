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
    .describe(`${what}, in pixels of the latest screen image, from its top left.`);

const scroll = (what: string) =>
  z.number().int().min(-COMPUTER_SCROLL_MAX).max(COMPUTER_SCROLL_MAX).optional().describe(what);

/** Said when the turn's model cannot read the screenshot every action answers with. */
const NEEDS_EYES =
  "Your model cannot read images, so you cannot use a computer: every step answers with a picture of the screen. Tell the person; they can switch this bot to a model that reads images in the chat's composer.";

/**
 * Using a computer (`25-bots.md` §4.2, "Using a computer"): a bot sees the
 * screen of one of the owner's hosts and uses its mouse and keyboard, one
 * action at a time, each answered with the screen after it. It reaches
 * outside Oppenheimer, so under Approve for me it asks first, once per host
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
      description: `Does one thing on the screen of one of the person's hosts (look, click, type, press keys, scroll, drag) and returns a picture of the screen after it, for work that only has a graphical interface: an app, a simulator, a website that needs a real browser. Start with action "screenshot"; every other action also answers with the new screen, so look at it before the next step. x and y are pixels of the latest image, from its top left. "type" types text where the keyboard focus is (click the field first); "key" presses keys with modifiers, such as "cmd+s", "ctrl+c" or "enter" (cmd is Command on a Mac, Super elsewhere). The host decides: its screen is off for bots until the person there runs \`runner computer on\`; a refusal says why, and you pass that on rather than trying around it. On a Mac it is the person's own screen and pointer, so they see what you do. The host defaults to your home host.`,
      input: z.object({
        action: z
          .enum(COMPUTER_ACTIONS)
          .describe(
            'screenshot (only look), wait (wait `seconds`, then look), move, click, double_click, right_click, middle_click (at x, y), drag (from x, y to to_x, to_y), scroll (at x, y by scroll_y and scroll_x), type (`text`), key (`keys`).',
          ),
        x: coordinate('Where to act, across'),
        y: coordinate('Where to act, down'),
        to_x: coordinate('Where a drag ends, across'),
        to_y: coordinate('Where a drag ends, down'),
        scroll_y: scroll('Wheel notches down; negative scrolls up.'),
        scroll_x: scroll('Wheel notches right; negative scrolls left.'),
        text: z
          .string()
          .min(1)
          .max(COMPUTER_TEXT_MAX)
          .optional()
          .describe('The text to type, as it is: never a password or a card number.'),
        keys: z
          .array(z.string().regex(COMPUTER_KEY_PATTERN))
          .min(1)
          .max(COMPUTER_KEYS_MAX)
          .optional()
          .describe(
            'Key presses, in order. Each is optional modifiers (ctrl, alt, shift, cmd) then one key, joined by +: a letter, a digit, f1 to f12, enter, tab, escape, backspace, delete, space, up, down, left, right, home, end, pageup, pagedown.',
          ),
        seconds: z
          .number()
          .int()
          .min(0)
          .max(COMPUTER_WAIT_MAX_SECONDS)
          .optional()
          .describe(`How long "wait" waits; at most ${COMPUTER_WAIT_MAX_SECONDS}.`),
        host_id: z
          .uuid()
          .optional()
          .describe('The host whose screen to use (from list_hosts); your home host when omitted.'),
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
            request: {
              action: input.action,
              ...(input.x !== undefined && { x: input.x }),
              ...(input.y !== undefined && { y: input.y }),
              ...(input.to_x !== undefined && { toX: input.to_x }),
              ...(input.to_y !== undefined && { toY: input.to_y }),
              ...(input.scroll_x !== undefined && { scrollX: input.scroll_x }),
              ...(input.scroll_y !== undefined && { scrollY: input.scroll_y }),
              ...(input.text !== undefined && { text: input.text }),
              ...(input.keys !== undefined && { keys: input.keys }),
              ...(input.seconds !== undefined && { seconds: input.seconds }),
            },
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
    if (!context.seesImages) throw new BotToolRefusal(NEEDS_EYES);
    const problem = computerCallProblem(input);
    if (problem) throw new BotToolRefusal(problem);
  }
}
