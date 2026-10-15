import type { BotEngineTool } from '@oppenheimer/backend-agents';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { ExceptionBase } from '@oppenheimer/backend-ddd';
import type { BotPermission } from '@oppenheimer/shared';
import { z } from 'zod/v4';
import { askedForApproval, waitingForApproval } from '../domain/bot-approval.policy';
import { fitToolOutput } from '../domain/bot-tool-text.policy';
import type { BotApprovalRequesterPort } from './bot-approval-requester.port';

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
  /** Where an asking tool's call goes under Approve for me: a Needs input card. */
  approvals: BotApprovalRequesterPort;
  /**
   * The one call the owner approved, when this context carries out an
   * approval: that tool, with exactly that input, runs without asking again.
   * Any other call made with the context still asks.
   */
  approved?: { tool: string; input: Record<string, unknown> };
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
   * The tool reaches outside Oppenheimer (it starts or stops work on a host,
   * posts to GitHub, creates a bot): under Approve for me it asks the owner
   * first. Its validated call becomes a Needs input card, the model is told
   * to end its turn, and the call runs only when the owner approves it.
   */
  asks?: boolean;
  /**
   * What the card says the call will do, in words, from its input: "Start
   * Claude Code on build-02 in acme/xrp-mobile: Fix the failing test".
   * Required with `asks`; a throw falls back to the tool and its input.
   */
  summarize?(input: z.output<Input>, context: BotToolContext): Promise<string> | string;
  /** Answers labelled text, ids inline; a throw becomes an error result the model reads. */
  run(input: z.output<Input>, context: BotToolContext, signal: AbortSignal): Promise<string>;
}

/** A declared tool, ready to be bound to a turn. */
export interface BotToolDefinition {
  readonly name: string;
  readonly description: string;
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
    bind: (context) => ({
      name: spec.name,
      description: spec.description,
      inputSchema,
      run: async (input, { signal }) => {
        const parsed = spec.input.safeParse(input ?? {});
        if (!parsed.success) {
          return { content: `Invalid input: ${describeIssues(parsed.error)}`, isError: true };
        }
        try {
          if (mustAsk(spec, context, parsed.data)) {
            return { content: await askOwner(spec, context, parsed.data) };
          }
          return { content: fitToolOutput(await spec.run(parsed.data, context, signal)) };
        } catch (error) {
          return { content: describeToolFailure(error), isError: true };
        }
      },
    }),
  };
}

/**
 * An asking tool asks under Approve for me, unless this context carries out
 * the owner's yes to this very call: the same tool, the same input.
 */
function mustAsk<Input extends z.ZodType>(
  spec: BotToolSpec<Input>,
  context: BotToolContext,
  input: unknown,
): boolean {
  if (!spec.asks || context.permission === 'full') return false;
  const { approved } = context;
  return !(approved?.tool === spec.name && canonicalJson(approved.input) === canonicalJson(input));
}

/** The call becomes a Needs input card, and the model is told what that means for its turn. */
async function askOwner<Input extends z.ZodType>(
  spec: BotToolSpec<Input>,
  context: BotToolContext,
  input: z.output<Input>,
): Promise<string> {
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
  context: BotToolContext,
  input: z.output<Input>,
  stored: Record<string, unknown>,
): Promise<string> {
  try {
    const summary = spec.summarize ? (await spec.summarize(input, context)).trim() : '';
    if (summary) return summary;
  } catch {
    // The card still says what will run, in the tool's own terms.
  }
  return `${spec.name} ${JSON.stringify(stored)}`;
}

/** The validated input as it is stored and compared: plain JSON, no `undefined`. */
function asStoredInput(input: unknown): Record<string, unknown> {
  const json: unknown = JSON.parse(JSON.stringify(input ?? {}));
  return json && typeof json === 'object' && !Array.isArray(json)
    ? (json as Record<string, unknown>)
    : { value: json };
}

/** JSON with every object's keys sorted: jsonb does not keep the order a call was written in. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value ?? null, (_key, inner: unknown) =>
    inner && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : inner,
  );
}

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
