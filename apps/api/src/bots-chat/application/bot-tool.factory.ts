import type { BotEngineTool } from '@oppenheimer/backend-agents';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { ExceptionBase } from '@oppenheimer/backend-ddd';
import { z } from 'zod/v4';
import { fitToolOutput } from '../domain/bot-tool-text.policy';

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
          return { content: fitToolOutput(await spec.run(parsed.data, context, signal)) };
        } catch (error) {
          return { content: describeToolFailure(error), isError: true };
        }
      },
    }),
  };
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
