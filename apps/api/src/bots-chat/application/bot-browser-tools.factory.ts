import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  BROWSER_ACTIONS,
  BROWSER_REF_PATTERN,
  BROWSER_URL_MAX,
  BROWSER_VIEWPORT_HEIGHT,
  BROWSER_VIEWPORT_WIDTH,
  COMPUTER_KEY_PATTERN,
  COMPUTER_KEYS_MAX,
  COMPUTER_SCROLL_MAX,
  COMPUTER_TEXT_MAX,
  COMPUTER_WAIT_MAX_SECONDS,
} from '@oppenheimer/shared/protocol';
import { z } from 'zod/v4';
import type { HostBrowserOutcome } from '../../sessions/application/host-browser.port';
import { UseHostBrowserCommand } from '../../sessions/commands/use-host-browser/use-host-browser.command';
import { toHostBrowserRequest } from '../bot-browser-tool.mapper';
import { promptText } from '../domain/bot-prompt-text.policy';
import {
  type BrowserCall,
  browserCallProblem,
  browserCommandIdOf,
  browserSummary,
  describeBrowser,
} from './bot-browser.policy';
import { BotHostTargetResolver } from './bot-host-target.resolver';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

/**
 * Using a browser (`product/design/bots/bots.md` §4.2, "Using a browser"): a bot drives a
 * browser of its own on one of the owner's hosts. It reads a page as a list
 * of what can be acted on, each with a ref, acts on a ref, and gets a picture
 * of the page when its model reads images. It reaches outside Oppenheimer,
 * so under Auto it asks first, once per host when the owner
 * answers "always"; and whatever the bot's permissions say, the host acts
 * only when the person on it ran `runner browser on`.
 */
@Injectable()
export class BotBrowserToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists the tool. */
  readonly group = 'sessions' as const;

  constructor(
    private readonly commandBus: CommandBus,
    private readonly hosts: BotHostTargetResolver,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.useBrowser()];
  }

  private useBrowser(): BotToolDefinition {
    return defineBotTool({
      name: 'use_browser',
      scope: 'sessions:write',
      asks: true,
      description: promptText('browser/tools.use-browser'),
      input: z.object({
        action: z.enum(BROWSER_ACTIONS).describe(promptText('browser/tools.use-browser-action')),
        url: z
          .string()
          .min(1)
          .max(BROWSER_URL_MAX)
          .optional()
          .describe(promptText('browser/tools.use-browser-url')),
        ref: z
          .string()
          .regex(BROWSER_REF_PATTERN)
          .optional()
          .describe(promptText('browser/tools.use-browser-ref')),
        x: z.number().int().min(0).max(BROWSER_VIEWPORT_WIDTH).optional(),
        y: z.number().int().min(0).max(BROWSER_VIEWPORT_HEIGHT).optional(),
        scroll_y: z
          .number()
          .int()
          .min(-COMPUTER_SCROLL_MAX)
          .max(COMPUTER_SCROLL_MAX)
          .optional()
          .describe(promptText('browser/tools.use-browser-scroll-y')),
        text: z
          .string()
          .min(1)
          .max(COMPUTER_TEXT_MAX)
          .optional()
          .describe(promptText('browser/tools.use-browser-text')),
        keys: z
          .array(z.string().regex(COMPUTER_KEY_PATTERN))
          .min(1)
          .max(COMPUTER_KEYS_MAX)
          .optional()
          .describe(promptText('browser/tools.use-browser-keys')),
        seconds: z
          .number()
          .int()
          .min(0)
          .max(COMPUTER_WAIT_MAX_SECONDS)
          .optional()
          .describe(
            promptText('browser/tools.use-browser-seconds', {
              maxSeconds: String(COMPUTER_WAIT_MAX_SECONDS),
            }),
          ),
        host_id: z.uuid().optional().describe(promptText('browser/tools.use-browser-host-id')),
      }),
      normalize: async (input, context) => {
        this.refuseUnusable(input, context, true);
        return { ...input, host_id: await this.hosts.usable(input, context) };
      },
      // One subject per host: "always" on a card lets every later step in
      // that browser run, where a card per click would make the tool useless.
      subject: async (input, context) => {
        const hostId = this.hosts.idOf(input, context);
        return {
          kind: 'host_browser',
          key: hostId,
          label: `its browser on ${await this.hosts.name(context, hostId)}`,
        };
      },
      summarize: async (input, context) =>
        browserSummary(input, await this.hosts.name(context, this.hosts.idOf(input, context))),
      run: async (input, context) => {
        const approved = context.approvalId !== undefined;
        this.refuseUnusable(input, context, !approved);
        const hostId = this.hosts.idOf(input, context);
        // A picture only where a model reads it: not for a model without
        // image input, and not for an approved call carried out after its turn.
        const picture = context.seesImages === true && !approved;
        const outcome = await this.commandBus.execute<UseHostBrowserCommand, HostBrowserOutcome>(
          new UseHostBrowserCommand({
            scope: context.owner,
            hostId,
            ...(context.approvalId ? { commandId: browserCommandIdOf(context.approvalId) } : {}),
            request: toHostBrowserRequest(input, context.botId.toLowerCase(), picture),
          }),
        );
        const image = outcome.kind === 'page' ? outcome.page.image : undefined;
        const content = describeBrowser(
          outcome,
          await this.hosts.name(context, hostId),
          image !== undefined,
        );
        return image
          ? { content, modelImages: [{ mimeType: 'image/jpeg', data: image }] }
          : content;
      },
    });
  }

  /** Refuses before any card: an action missing a part, or a picture nobody could read. */
  private refuseUnusable(input: BrowserCall, context: BotToolCallContext, inTurn: boolean): void {
    const problem = browserCallProblem(input);
    if (problem) throw new BotToolRefusal(problem);
    if (inTurn && input.action === 'screenshot' && !context.seesImages) {
      throw new BotToolRefusal(promptText('browser/tools.no-eyes'));
    }
  }
}
