import { Inject, Injectable } from '@nestjs/common';
import {
  BOT_CHANNEL_ORIGINS,
  parseVisual,
  VISUAL_BLOCKS_MAX,
  VISUAL_SERIES_MAX,
} from '@oppenheimer/shared';
import { z } from 'zod/v4';
import type { FlagEvaluatorPort } from '../../feature-flags/application/flag-evaluator.port';
import { FLAG_EVALUATOR } from '../../feature-flags/feature-flags.di-tokens';
import { NOT_ON_A_GITHUB_ASK } from '../domain/bot-github-ask.policy';
import { promptText } from '../domain/bot-prompt-text.policy';
import { VISUALS_PER_TURN } from '../domain/bot-visual.policy';
import {
  type BotToolArea,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

/**
 * The blocks are taken loose and checked against the one visual schema in
 * `@oppenheimer/shared`, which is classic Zod and so cannot be the engine's
 * input: the description teaches each block's fields, and a spec that fails
 * is answered with the path of each fault so the model can fix it.
 */
const showVisualInput = z.object({
  title: z.string().max(120).describe(promptText('core/tools-visual.show-visual-title')),
  subtitle: z
    .string()
    .max(240)
    .optional()
    .describe(promptText('core/tools-visual.show-visual-subtitle')),
  blocks: z
    .array(z.record(z.string(), z.unknown()))
    .min(1)
    .max(VISUAL_BLOCKS_MAX)
    .describe(promptText('core/tools-visual.show-visual-blocks')),
});

/**
 * `show_visual`: a bot draws a visual in its chat, a title and typed blocks
 * the console draws with its own charts, so no code of the model's runs. It
 * reaches nothing outside Oppenheimer and never asks first. An `html` block
 * runs the model's own page in a sandboxed frame; the `visual_html` flag
 * refuses it. It is not offered on a turn whose reply goes out as text
 * (Telegram, WhatsApp, Slack, a GitHub comment): nothing draws it there, and
 * the description tells the model to put figures in it and not repeat them.
 */
@Injectable()
export class BotVisualToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'self' as const;

  constructor(@Inject(FLAG_EVALUATOR) private readonly flags: FlagEvaluatorPort) {}

  definitions(): readonly BotToolDefinition[] {
    return [
      defineBotTool({
        name: 'show_visual',
        scope: 'bots:write',
        notOn: [...BOT_CHANNEL_ORIGINS, ...NOT_ON_A_GITHUB_ASK],
        description: promptText('core/tools-visual.show-visual', {
          blocksMax: String(VISUAL_BLOCKS_MAX),
          seriesMax: String(VISUAL_SERIES_MAX),
          visualsPerTurn: String(VISUALS_PER_TURN),
        }),
        input: showVisualInput,
        run: async (input, context) => {
          const parsed = parseVisual(input);
          if (!parsed.ok) {
            throw new BotToolRefusal(
              promptText('core/tools-visual.invalid', {
                errors: parsed.errors.map((error) => `- ${error}`).join('\n'),
              }),
            );
          }
          if (!context.budget.take('show_visual', VISUALS_PER_TURN)) {
            throw new BotToolRefusal(
              promptText('core/tools-visual.visuals-spent', {
                visualsPerTurn: String(VISUALS_PER_TURN),
              }),
            );
          }
          const { visual } = parsed;
          // HTML runs the model's code in the person's console: a workspace can turn it off.
          if (
            visual.blocks.some((block) => block.type === 'html') &&
            !this.flags.isEnabled('visual_html', { organizationId: context.organizationId })
          ) {
            throw new BotToolRefusal(promptText('core/tools-visual.html-off'));
          }
          return {
            content: promptText('core/tools-visual.shown', {
              title: visual.title,
              blocks: visual.blocks.map((block) => block.type).join(', '),
            }),
            visual,
          };
        },
      }),
    ];
  }
}
