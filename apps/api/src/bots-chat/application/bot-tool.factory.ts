import type { BotEngineTool } from '@oppenheimer/backend-agents';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { ExceptionBase } from '@oppenheimer/backend-ddd';
import type { BotPermission, BotSubagentRun, Scope } from '@oppenheimer/shared';
import { z } from 'zod/v4';
import { askedForApproval, waitingForApproval } from '../domain/bot-approval.policy';
import { SUBAGENT_DATA_KEY } from '../domain/bot-subagent.policy';
import { fitToolOutput } from '../domain/bot-tool-text.policy';
import type { BotTurnBudget } from '../domain/bot-turn-budget.policy';
import type { BotApprovalRequesterPort } from './bot-approval-requester.port';

/**
 * What a tool's call acts with: the owner's scope, the bot, the turn, the
 * sender's zone. It holds no way to ask, so a call made with it alone, an
 * approved call carried out, can never raise another card.
 */
export interface BotToolCallContext {
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
  /**
   * The scopes of the credential the turn was sent with; null for a browser
   * session. What a tool saves to act later (a routine) keeps them, so a
   * token reaches no further through the bot than through a message.
   */
  credentialScopes: readonly Scope[] | null;
  /**
   * Runs `delegate`'s children inside this turn (`BotSubagentRunnerFactory`).
   * Absent where no child may start: a child's own tools, and an approved
   * call carried out after its turn, so delegation is one level deep.
   */
  subagents?: BotSubagentRunner;
}

/** One task a `delegate` call hands a child, with the context the bot chose to give it. */
export interface BotSubagentTask {
  task: string;
  context?: string;
}

/** Runs a turn's children, in parallel and bounded, each to an end it reports. */
export interface BotSubagentRunner {
  run(tasks: readonly BotSubagentTask[], signal: AbortSignal): Promise<BotSubagentRun[]>;
}

/** A turn's context: a call's, and where an asking tool's call goes under Approve for me. */
export interface BotToolContext extends BotToolCallContext {
  approvals: BotApprovalRequesterPort;
}

/**
 * The context an approved call is carried out with: no requester, so it
 * cannot ask again, and the approval it carries out, which keys its effect
 * (the same approval starts one session however often its job is retried).
 */
export interface ApprovedCallContext extends BotToolCallContext {
  approvalId: string;
}

/**
 * A tool's answer with the session its call started, apart from its words:
 * the chat links to the session from this, never from the words.
 */
export interface BotToolAnswer {
  content: string;
  sessionId?: string;
  /** The children a `delegate` call ran, for the chat to show under its line. */
  subagents?: readonly BotSubagentRun[];
}

/** What a call ended with: the words the model reads, and the session it started, if any. */
export interface BotToolResult {
  content: string;
  isError: boolean;
  sessionId?: string;
  subagents?: readonly BotSubagentRun[];
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
  /**
   * What the tool does in a new bot's first chat, as one step of the prompt's
   * Getting started list (`composeBotSystemPrompt`). Only a tool that sets
   * the bot up has one; the list shows the steps of the tools a turn offers.
   */
  setupStep?: string;
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
   * first. Its validated call becomes a Needs input card, the model is told
   * to end its turn, and the call runs only when the owner approves it.
   */
  asks?: boolean;
  /**
   * The tool only reads: it starts, changes and sends nothing, so a
   * `delegate` child may be offered it. Never set beside `asks`.
   */
  readOnly?: boolean;
  /**
   * What the card says the call will do, in words, from its input: "Start
   * Claude Code on build-02 in acme/xrp-mobile: Fix the failing test".
   * Required with `asks`. A `BotToolRefusal` refuses the call before any
   * card is raised; any other throw falls back to the tool and its input.
   */
  summarize?(input: z.output<Input>, context: BotToolCallContext): Promise<string> | string;
  /**
   * An asking tool's call as the card stores it, with every default it
   * resolves from what may change while the card waits written out, so a
   * yes runs what the card showed. The card's line is drawn from it, and a
   * `BotToolRefusal` refuses the call before any card. Optional: without
   * it the validated input is stored as given.
   */
  normalize?(
    input: z.output<Input>,
    context: BotToolCallContext,
  ): Promise<z.output<Input>> | z.output<Input>;
  /**
   * Answers labelled text, ids inline, or a `BotToolAnswer` when the call
   * started a session; a throw becomes an error result the model reads.
   * `context.approvalId` is set when it carries out an approval.
   */
  run(
    input: z.output<Input>,
    context: BotToolCallContext & { approvalId?: string },
    signal: AbortSignal,
  ): Promise<string | BotToolAnswer>;
}

/** A declared tool, ready to be bound to a turn. */
export interface BotToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly setupStep?: string;
  readonly scope: Scope;
  /** Whether it only reads, so a child may be offered it. */
  readonly readOnly: boolean;
  /** The tool for one turn; an asking tool asks first under Approve for me. */
  bind(context: BotToolContext): BotEngineTool;
  /**
   * Carries out an approved call: the stored input, already validated when
   * the card was raised, straight to the tool's run, with no asking.
   */
  runApproved(
    input: Record<string, unknown>,
    context: ApprovedCallContext,
    signal: AbortSignal,
  ): Promise<BotToolResult>;
}

/** What an area of the API offers bots: one class per area, each a list of tools. */
export interface BotToolArea {
  definitions(): readonly BotToolDefinition[];
}

/**
 * Turns a spec into a tool both engines can run: the input checked against
 * its schema (a bad call comes back as an error the model can correct), the
 * answer cut to a size a prompt can hold, and an `AppError` read back as its
 * code, title and detail rather than a bare message. An asking tool is the
 * same tool behind `askingFirst`.
 */
export function defineBotTool<Input extends z.ZodType>(
  spec: BotToolSpec<Input>,
): BotToolDefinition {
  if (spec.asks && spec.readOnly) {
    throw new Error(`${spec.name} cannot both ask first and be read-only.`);
  }
  const { $schema: _dialect, ...inputSchema } = z.toJSONSchema(spec.input, { io: 'input' });
  const call = async (
    input: z.output<Input>,
    context: BotToolCallContext & { approvalId?: string },
    signal: AbortSignal,
  ): Promise<BotToolResult> => {
    try {
      const answer = await spec.run(input, context, signal);
      if (typeof answer === 'string') return { content: fitToolOutput(answer), isError: false };
      return {
        content: fitToolOutput(answer.content),
        isError: false,
        ...(answer.sessionId ? { sessionId: answer.sessionId } : {}),
        ...(answer.subagents ? { subagents: answer.subagents } : {}),
      };
    } catch (error) {
      return { content: describeToolFailure(error), isError: true };
    }
  };
  return {
    name: spec.name,
    description: spec.description,
    setupStep: spec.setupStep,
    scope: spec.scope,
    readOnly: spec.readOnly === true,
    bind: (context) => {
      const tool: BotEngineTool = {
        name: spec.name,
        description: spec.description,
        inputSchema,
        run: async (input, { signal }) => {
          const parsed = spec.input.safeParse(input ?? {});
          if (!parsed.success) {
            return { content: `Invalid input: ${describeIssues(parsed.error)}`, isError: true };
          }
          const { sessionId, subagents, ...result } = await call(parsed.data, context, signal);
          const data = {
            ...(sessionId ? { sessionId } : {}),
            ...(subagents ? { [SUBAGENT_DATA_KEY]: JSON.stringify(subagents) } : {}),
          };
          return Object.keys(data).length > 0 ? { ...result, data } : result;
        },
      };
      return spec.asks && context.permission !== 'full' ? askingFirst(tool, spec, context) : tool;
    },
    runApproved: (input, context, signal) => call(input as z.output<Input>, context, signal),
  };
}

/**
 * An asking tool under Approve for me (`25-bots.md` §5): a valid call becomes
 * a Needs input card instead of running, and the model is told to end its
 * turn, or to wait when a card is already up. A bad call is the tool's own
 * error, unchanged.
 */
function askingFirst<Input extends z.ZodType>(
  tool: BotEngineTool,
  spec: BotToolSpec<Input>,
  context: BotToolContext,
): BotEngineTool {
  return {
    ...tool,
    run: async (input, options) => {
      const parsed = spec.input.safeParse(input ?? {});
      if (!parsed.success) return tool.run(input, options);
      try {
        return { content: await askOwner(spec, context, parsed.data) };
      } catch (error) {
        return { content: describeToolFailure(error), isError: true };
      }
    },
  };
}

/** The call becomes a card, its input stored as validated, and the model is told what that means. */
async function askOwner<Input extends z.ZodType>(
  spec: BotToolSpec<Input>,
  context: BotToolContext,
  given: z.output<Input>,
): Promise<string> {
  const input = spec.normalize ? await spec.normalize(given, context) : given;
  const stored = asStoredInput(input);
  const summary = await summaryOf(spec, context, input, stored);
  const outcome = await context.approvals.request({
    organizationId: context.organizationId,
    botId: context.botId,
    turnId: context.turnId,
    tool: spec.name,
    input: stored,
    summary,
  });
  return outcome.status === 'requested'
    ? askedForApproval(summary)
    : waitingForApproval(outcome.summary);
}

async function summaryOf<Input extends z.ZodType>(
  spec: BotToolSpec<Input>,
  context: BotToolCallContext,
  input: z.output<Input>,
  stored: Record<string, unknown>,
): Promise<string> {
  try {
    const summary = spec.summarize ? (await spec.summarize(input, context)).trim() : '';
    if (summary) return summary;
  } catch (error) {
    // A call the tool would refuse raises no card: the owner is never asked
    // to approve what cannot run.
    if (error instanceof BotToolRefusal) throw error;
    // Anything else: the card still says what will run, in the tool's own terms.
  }
  return `${spec.name} ${JSON.stringify(stored)}`;
}

/** The validated input as it is stored: plain JSON, no `undefined`. */
function asStoredInput(input: unknown): Record<string, unknown> {
  const json: unknown = JSON.parse(JSON.stringify(input ?? {}));
  return json && typeof json === 'object' && !Array.isArray(json)
    ? (json as Record<string, unknown>)
    : { value: json };
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.length ? `${issue.path.join('.')}: ` : ''}${issue.message}`)
    .join('; ');
}

/**
 * A tool's own refusal: nothing was done, and the words say what to ask or
 * fix. Thrown rather than returned, so the call ends as an error (an approved
 * call that refuses ends `failed`, not `approved`).
 */
export class BotToolRefusal extends Error {}

/** A failure in words the model can act on: a refusal's words, or our catalog's code, title and detail. */
export function describeToolFailure(error: unknown): string {
  if (error instanceof BotToolRefusal) return error.message;
  if (error instanceof AppError) {
    return `${error.code}: ${error.title}.${error.detail ? ` ${error.detail}` : ''}`;
  }
  if (error instanceof ExceptionBase) return `${error.code}: ${error.message}`;
  return 'The tool failed unexpectedly. Say so; do not retry it in this turn.';
}
