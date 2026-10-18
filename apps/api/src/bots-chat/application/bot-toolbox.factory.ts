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
import type {
  ApprovedCallContext,
  BotToolArea,
  BotToolContext,
  BotToolDefinition,
  BotToolPolicy,
} from './bot-tool.factory';
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
    return this.definitions(granted).map(({ name, description, setupStep }) => ({
      name,
      description,
      setupStep,
    }));
  }

  /** The same tools, bound to one turn. */
  tools(context: BotToolContext, granted: readonly Scope[] | null): BotEngineTool[] {
    return this.definitions(granted).map((definition) => definition.bind(context));
  }

  /**
   * Carries out what the owner approved (`25-bots.md` §5): the stored input,
   * validated when the card was raised, straight to the tool's run. Only if
   * `granted` (what the asking turn's and the deciding credential's scopes
   * both cover; null for none narrower than the owner) covers the tool's
   * scope; otherwise nothing runs. A tool gone since is a failed run.
   */
  async runApproved(
    context: ApprovedCallContext,
    granted: readonly Scope[] | null,
    call: { tool: string; input: Record<string, unknown> },
    signal: AbortSignal,
  ): Promise<{ content: string; isError: boolean }> {
    const definition = this.definitions(null).find((candidate) => candidate.name === call.tool);
    if (!definition)
      return { content: `Not run: ${call.tool} is no longer a tool.`, isError: true };
    if (granted !== null && !expandScopes(granted).has(definition.scope)) {
      return {
        content: `Not run: your credential does not cover ${definition.scope}.`,
        isError: true,
      };
    }
    return definition.runApproved(call.input, context, signal);
  }

  /** The role rule a tool's call needs beyond its scope, if it has one; null for a tool gone since. */
  policyOf(tool: string): BotToolPolicy | null {
    return this.definitions(null).find((candidate) => candidate.name === tool)?.policy ?? null;
  }

  private definitions(granted: readonly Scope[] | null): BotToolDefinition[] {
    const all = this.areas.flatMap((area) => area.definitions());
    if (granted === null) return all;
    const covered = expandScopes(granted);
    return all.filter((definition) => covered.has(definition.scope));
  }
}
