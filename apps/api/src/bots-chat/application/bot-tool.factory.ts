import type { BotEngineTool } from '@oppenheimer/backend-agents';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { ExceptionBase } from '@oppenheimer/backend-ddd';
import type { BotPermission, Scope } from '@oppenheimer/shared';
import { z } from 'zod/v4';
import { fitToolOutput } from '../domain/bot-tool-text.policy';
import type { BotTurnBudget } from '../domain/bot-turn-budget.policy';

/** What every tool of a turn acts with: the owner's scope, the bot, the turn, the sender's zone. */
export interface BotToolContext {
  /** The bot's owner's scope, resolved for this turn (`BotOwnerScopeResolver`). */
  owner: AccessScope;
  organizationId: string;
  botId: string;
  turnId: string;
  homeHostId: string | null;
  /** The sender's IANA zone; times a tool writes are in it. */
  timeZone: string;
  /**
   * The bot's approval preset (`25-bots.md` §5): `auto` (Approve for me)
   * runs what stays inside Oppenheimer and asks for what reaches outside it;
   * `full` runs everything.
   */
  permission: BotPermission;
  /** What this turn may still spend on calls a tool limits per turn. */
  budget: BotTurnBudget;
}

/** One tool as an area declares it: a name, what it does, its input, and what it runs. */
export interface BotToolSpec<Input extends z.ZodType> {
  /** snake_case, from the catalog in `25-bots.md` §4. */
  name: string;
  /**
   * The first sentence says what it does (the prompt's list shows it); then
   * when to use it rather than a sibling, its limits as numbers, and what an
   * empty answer does and does not mean.
   */
  description: string;
  input: Input;
  /**
   * The credential scope a call needs, as the route the tool stands in for
   * requires it. A turn sent through an API token or OAuth grant is offered
   * only the tools its scopes cover; a browser session, all of them.
   */
  scope: Scope;
  /**
   * The tool reaches outside Oppenheimer (it starts or stops work on a host,
   * posts to GitHub, creates a bot): under Approve for me it asks the owner
   * first. Until the Needs input card exists, asking means not running, and
   * telling the model so.
   */
  asks?: boolean;
  /** Answers labelled text, ids inline; a throw becomes an error result the model reads. */
  run(input: z.output<Input>, context: BotToolContext, signal: AbortSignal): Promise<string>;
}

/** A declared tool, ready to be bound to a turn. */
export interface BotToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly scope: Scope;
  bind(context: BotToolContext): BotEngineTool;
}

/** What an area of the API offers bots: one class per area, each a list of tools. */
export interface BotToolArea {
  definitions(): readonly BotToolDefinition[];
}

/**
 * Turns a spec into a tool both engines can run: the input checked against
 * its schema (a bad call comes back as an error the model can correct), the
 * answer cut to a size a prompt can hold, and an `AppError` read back as its
 * code, title and detail rather than a bare message.
 */
export function defineBotTool<Input extends z.ZodType>(
  spec: BotToolSpec<Input>,
): BotToolDefinition {
  const { $schema: _dialect, ...inputSchema } = z.toJSONSchema(spec.input, { io: 'input' });
  return {
    name: spec.name,
    description: spec.description,
    scope: spec.scope,
    bind: (context) => ({
      name: spec.name,
      description: spec.description,
      inputSchema,
      run: async (input, { signal }) => {
        if (spec.asks && context.permission !== 'full') return { content: NEEDS_APPROVAL };
        const parsed = spec.input.safeParse(input ?? {});
        if (!parsed.success) {
          return { content: `Invalid input: ${describeIssues(parsed.error)}`, isError: true };
        }
        try {
          return { content: fitToolOutput(await spec.run(parsed.data, context, signal)) };
        } catch (error) {
          return { content: describeToolFailure(error), isError: true };
        }
      },
    }),
  };
}

/** What an asking tool answers while its bot is on Approve for me and the card does not exist yet. */
export const NEEDS_APPROVAL =
  "Not done: this needs the person's approval, and approving from the chat is not built yet. Tell them what you would do, with the exact details, so they can do it themselves; or, if they want you to do such things without asking, they can switch your approval setting to Full access in the composer.";

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.length ? `${issue.path.join('.')}: ` : ''}${issue.message}`)
    .join('; ');
}

/** A failure in words the model can act on: our catalog's code, title and detail. */
export function describeToolFailure(error: unknown): string {
  if (error instanceof AppError) {
    return `${error.code}: ${error.title}.${error.detail ? ` ${error.detail}` : ''}`;
  }
  if (error instanceof ExceptionBase) return `${error.code}: ${error.message}`;
  return 'The tool failed unexpectedly. Say so; do not retry it in this turn.';
}
