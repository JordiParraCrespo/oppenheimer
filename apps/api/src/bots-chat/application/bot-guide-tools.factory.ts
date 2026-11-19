import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod/v4';
import { guideIndexText, guidePageText } from '../domain/bot-guide.policy';
import { promptText } from '../domain/bot-prompt-text.policy';
import { type BotToolArea, type BotToolDefinition, defineBotTool } from './bot-tool.factory';

/**
 * Oppenheimer's own guide: the pages the docs site publishes as "Using
 * Oppenheimer", generated into `@oppenheimer/shared/guide` from
 * `apps/docs/docs/guide`, so a bot reads the product as it is in the version
 * this API runs, with no site to reach. The built-in `oppenheimer` skill says
 * when to read it. Listed under Itself in Settings → Permissions: it reads
 * nothing of the workspace.
 */
@Injectable()
export class BotGuideToolsFactory implements BotToolArea {
  readonly group = 'self' as const;

  constructor(private readonly config: ConfigService) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.readGuide()];
  }

  private readGuide(): BotToolDefinition {
    return defineBotTool({
      name: 'read_oppenheimer_docs',
      readOnly: true,
      scope: 'bots:read',
      description: promptText('tools/guide.read-oppenheimer-docs'),
      input: z.strictObject({
        page: z
          .string()
          .trim()
          .max(80)
          .optional()
          .describe(promptText('tools/guide.read-oppenheimer-docs-page')),
      }),
      run: async (input) =>
        input.page ? guidePageText(input.page, this.docsUrl) : guideIndexText(this.docsUrl),
    });
  }

  /** The docs site, when this deployment says where it is published (`DOCS_URL`). */
  private get docsUrl(): string | null {
    return this.config.get<string>('bots.docsUrl') ?? null;
  }
}
