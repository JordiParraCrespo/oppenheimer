import { Injectable } from '@nestjs/common';
import type { BotEngineTool } from '@oppenheimer/backend-agents';
import { expandScopes, type Scope } from '@oppenheimer/shared';
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

  /**
   * The tools a turn is offered, as the prompt names them. `granted` is the
   * scopes of the credential the turn was sent with: null for a browser
   * session (every tool), or a token's scopes (only the tools they cover).
   */
  catalog(granted: readonly Scope[] | null): BotPromptTool[] {
    return this.definitions(granted).map(({ name, description }) => ({ name, description }));
  }

  /** The same tools, bound to one turn. */
  tools(context: BotToolContext, granted: readonly Scope[] | null): BotEngineTool[] {
    return this.definitions(granted).map((definition) => definition.bind(context));
  }

  private definitions(granted: readonly Scope[] | null): BotToolDefinition[] {
    const all = this.areas.flatMap((area) => area.definitions());
    if (granted === null) return all;
    const covered = expandScopes(granted);
    return all.filter((definition) => covered.has(definition.scope));
  }
}
