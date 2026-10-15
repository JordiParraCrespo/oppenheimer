import { Injectable } from '@nestjs/common';
import type { BotEngineTool } from '@oppenheimer/backend-agents';
import type { BotPromptTool } from '../domain/bot-prompt.policy';
import { BotHostToolsFactory } from './bot-host-tools.factory';
import type { BotToolArea, BotToolContext, BotToolDefinition } from './bot-tool.factory';

/**
 * Every tool a bot's turn is offered (`25-bots.md` §4), area by area. A tool
 * is offered only here: the prompt's list of what the bot can do is read
 * from the same definitions, so the two never disagree.
 */
@Injectable()
export class BotToolboxFactory {
  private readonly areas: readonly BotToolArea[];

  constructor(hosts: BotHostToolsFactory) {
    this.areas = [hosts];
  }

  /** The tools, as the prompt names them. */
  catalog(): BotPromptTool[] {
    return this.definitions().map(({ name, description }) => ({ name, description }));
  }

  /** The tools, bound to one turn. */
  tools(context: BotToolContext): BotEngineTool[] {
    return this.definitions().map((definition) => definition.bind(context));
  }

  private definitions(): BotToolDefinition[] {
    return this.areas.flatMap((area) => area.definitions());
  }
}
