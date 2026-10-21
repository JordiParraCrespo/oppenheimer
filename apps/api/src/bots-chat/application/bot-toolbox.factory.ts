import { Injectable } from '@nestjs/common';
import type { BotEngineTool } from '@oppenheimer/backend-agents';
import { expandScopes, type Scope } from '@oppenheimer/shared';
import { ownerLacksPermission } from '../domain/bot-owner-permission.policy';
import type { BotPromptTool } from '../domain/bot-prompt.policy';
import { BotAutomationToolsFactory } from './bot-automation-tools.factory';
import { BotPeerToolsFactory } from './bot-bots-tools.factory';
import { BotGithubToolsFactory } from './bot-github-tools.factory';
import { BotHostToolsFactory } from './bot-host-tools.factory';
import { BotIssueToolsFactory } from './bot-issue-tools.factory';
import { BotPlanToolsFactory } from './bot-plan-tools.factory';
import { BotPullRequestToolsFactory } from './bot-pull-request-tools.factory';
import { BotRoutineToolsFactory } from './bot-routine-tools.factory';
import { BotSelfToolsFactory } from './bot-self-tools.factory';
import { BotSessionToolsFactory } from './bot-session-tools.factory';
import type {
  ApprovedCallContext,
  BotToolArea,
  BotToolContext,
  BotToolDefinition,
  BotToolResult,
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
    pullRequests: BotPullRequestToolsFactory,
    issues: BotIssueToolsFactory,
    automations: BotAutomationToolsFactory,
    routines: BotRoutineToolsFactory,
    peers: BotPeerToolsFactory,
    web: BotWebToolsFactory,
  ) {
    this.areas = [
      self,
      hosts,
      sessions,
      plan,
      github,
      pullRequests,
      issues,
      automations,
      routines,
      peers,
      web,
    ];
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

  /**
   * The same tools, bound to one turn. `held` reads what the owner's roles
   * let them do now (`BotOwnerPermissionsResolver`), at every call, so a role
   * removed mid-turn stops the next call: a tool outside it stays offered,
   * and its call is refused before it runs or raises a card, in words the
   * bot passes on.
   */
  tools(
    context: BotToolContext,
    granted: readonly Scope[] | null,
    held: HeldScopes,
  ): BotEngineTool[] {
    return this.definitions(granted).map((definition) => {
      const tool = definition.bind(context);
      // The permission comes before asking: a refused tool raises no card.
      return {
        ...tool,
        run: async (input, options) =>
          (await refusalFor(definition, held)) ?? tool.run(input, options),
      };
    });
  }

  /**
   * Carries out what the owner approved (`25-bots.md` §5): the stored input,
   * validated when the card was raised, straight to the tool's run. Only if
   * `granted` (what the asking turn's and the deciding credential's scopes
   * both cover; null for none narrower than the owner) covers the tool's
   * scope, and the owner's roles still do (`held`, read when it runs, so a
   * role removed while the card waited stops it); otherwise nothing runs. A
   * tool gone since is a failed run.
   */
  async runApproved(
    context: ApprovedCallContext,
    granted: readonly Scope[] | null,
    held: HeldScopes,
    call: { tool: string; input: Record<string, unknown> },
    signal: AbortSignal,
  ): Promise<BotToolResult> {
    const definition = this.definitions(null).find((candidate) => candidate.name === call.tool);
    if (!definition)
      return { content: `Not run: ${call.tool} is no longer a tool.`, isError: true };
    if (granted !== null && !expandScopes(granted).has(definition.scope)) {
      return {
        content: `Not run: your credential does not cover ${definition.scope}.`,
        isError: true,
      };
    }
    return (
      (await refusalFor(definition, held)) ?? definition.runApproved(call.input, context, signal)
    );
  }

  private definitions(granted: readonly Scope[] | null): BotToolDefinition[] {
    const all = this.areas.flatMap((area) => area.definitions());
    if (granted === null) return all;
    const covered = expandScopes(granted);
    return all.filter((definition) => covered.has(definition.scope));
  }
}

/** Reads the owner's scopes as their roles stand at the moment of the call. */
export type HeldScopes = () => Promise<ReadonlySet<Scope>>;

/**
 * The one gate between a tool and its owner's roles, for a live call and an
 * approved one alike, read when the call is made: the refusal when the
 * owner lacks the tool's scope, else nothing and the tool's own run path
 * decides.
 */
async function refusalFor(
  definition: BotToolDefinition,
  held: HeldScopes,
): Promise<BotToolResult | null> {
  if ((await held()).has(definition.scope)) return null;
  return { content: ownerLacksPermission(definition.name, definition.scope), isError: true };
}
