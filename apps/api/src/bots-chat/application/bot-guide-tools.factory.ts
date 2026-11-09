import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod/v4';
import { guideIndexText, guidePageText } from '../domain/bot-guide.policy';
import { type BotToolArea, type BotToolDefinition, defineBotTool } from './bot-tool.factory';

/**
 * Oppenheimer's own guide (`25-bots.md` §4.1, "Oppenheimer's own guide"): the
 * pages the docs site publishes as "Using Oppenheimer", generated into
 * `@oppenheimer/shared/guide` from `apps/docs/docs/guide`, so a bot reads the
 * product as it is in the version this API runs, with no site to reach. The
 * built-in `oppenheimer` skill says when to read it. Listed under Itself in
 * Settings → Permissions: it reads nothing of the workspace.
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
      description:
        "Reads Oppenheimer's own guide: what Oppenheimer is, how its hosts, sessions, projects, bots, routines, automations, inbox, GitHub, CLI and MCP work, where things are in the console and how to set them up. Use it before answering any question about Oppenheimer itself or about what bots can do in it, and answer from what it says. With no page it lists the pages and what each covers; with a page id it returns that page.",
      input: z.strictObject({
        page: z
          .string()
          .trim()
          .max(80)
          .optional()
          .describe(
            'The page to read, by its id from the index (e.g. "sessions"); a `./sessions.md` link works too. Leave it out for the index.',
          ),
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
