import { Injectable } from '@nestjs/common';
import type { BotEngineTool } from '@oppenheimer/backend-agents';
import type { BotPromptTool } from '../domain/bot-prompt.policy';
import { BotAutomationToolsFactory } from './bot-automation-tools.factory';
import { BotPeerToolsFactory } from './bot-bots-tools.factory';
import { BotGithubToolsFactory } from './bot-github-tools.factory';
import { BotHostToolsFactory } from './bot-host-tools.factory';
import { BotPlanToolsFactory } from './bot-plan-tools.factory';
import { BotSelfToolsFactory } from './bot-self-tools.factory';
import { BotSessionToolsFactory } from './bot-session-tools.factory';
import type { BotToolArea, BotToolContext, BotToolDefinition } from './bot-tool.factory';
import { BotWebToolsFactory } from './bot-web-tools.factory';

/**
 * Every tool a bot's turn is offered (`25-bots.md` §4), area by area. A tool
 * is offered only here: the prompt's list of what the bot can do is read
 * from the same definitions, so the two never disagree.
 */
@Injectable()
export class BotToolboxFactory {
  private readonly areas: readonly BotToolArea[];

  constructor(
    self: BotSelfToolsFactory,
    hosts: BotHostToolsFactory,
    sessions: BotSessionToolsFactory,
    plan: BotPlanToolsFactory,
    github: BotGithubToolsFactory,
    automations: BotAutomationToolsFactory,
    peers: BotPeerToolsFactory,
    web: BotWebToolsFactory,
  ) {
    this.areas = [self, hosts, sessions, plan, github, automations, peers, web];
  }

  /** The tools, as the prompt names them. */
  catalog(): BotPromptTool[] {
    return this.definitions().map(({ name, description }) => ({ name, description }));
  }

  /** The tools, bound to one turn. */
  tools(context: BotToolContext): BotEngineTool[] {
    return this.definitions().map((definition) => definition.bind(context));
  }

  /**
   * Carries out what the owner approved (`25-bots.md` §5): the stored tool
   * with the stored input, bound to a context that lets exactly that call
   * through and asks for any other. A tool gone since the card was raised is
   * a failed run, not a crash.
   */
  async runApproved(
    context: BotToolContext,
    call: { tool: string; input: Record<string, unknown> },
    signal: AbortSignal,
  ): Promise<{ content: string; isError: boolean }> {
    const definition = this.definitions().find((candidate) => candidate.name === call.tool);
    if (!definition) return { content: `${call.tool} is no longer a tool.`, isError: true };
    const answer = await definition
      .bind({ ...context, approved: call })
      .run(call.input, { signal });
    return { content: answer.content, isError: answer.isError === true };
  }

  private definitions(): BotToolDefinition[] {
    return this.areas.flatMap((area) => area.definitions());
  }
}
