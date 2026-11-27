// One bot turn against a real model, for the bot evals (`bot-memory`,
// `bot-skills`, `bot-session-search`): a system prompt, the person's message
// and the tools the eval serves, looped model → calls → results → model
// until the model answers or the turn's cap. Which transport runs it is the
// machine's: the Messages API with `ANTHROPIC_API_KEY`, otherwise the Claude
// Agent SDK on the machine's Claude Code login, with the tools served the way
// the Claude bot engine serves them
// (`packages/backend/agents/src/claude/claude-tool-server.ts`).
//
// Also the evals' common plumbing: their flags, a bounded pool, and the
// report each writes under its own `reports/`.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Anthropic from '@anthropic-ai/sdk';
import { startEvalRecording } from '../../.agents/hooks/verification.mjs';
import { BotCheckBackToolsFactory } from '../../apps/api/src/bots-chat/application/bot-check-back-tools.factory';
import { BotFormToolsFactory } from '../../apps/api/src/bots-chat/application/bot-form-tools.factory';
import { BotGoalToolsFactory } from '../../apps/api/src/bots-chat/application/bot-goal-tools.factory';
import { BotGuideToolsFactory } from '../../apps/api/src/bots-chat/application/bot-guide-tools.factory';
import { BotLoopToolsFactory } from '../../apps/api/src/bots-chat/application/bot-loop-tools.factory';
import { BotNoticeToolsFactory } from '../../apps/api/src/bots-chat/application/bot-notice-tools.factory';
import { BotQuestionToolsFactory } from '../../apps/api/src/bots-chat/application/bot-question-tools.factory';
import { BotSelfToolsFactory } from '../../apps/api/src/bots-chat/application/bot-self-tools.factory';
import { BotSkillToolsFactory } from '../../apps/api/src/bots-chat/application/bot-skill-tools.factory';
import { alwaysLoaded } from '../../apps/api/src/bots-chat/application/bot-toolbox.factory';
import { BotVisualToolsFactory } from '../../apps/api/src/bots-chat/application/bot-visual-tools.factory';
import {
  claudeSystemPrompt,
  DEFER_TOOLS_ABOVE_CHARS,
} from '../../packages/backend/agents/src/claude/claude-options';

const HERE = dirname(fileURLToPath(import.meta.url));

// Every bot eval loads this first: its green exit then records it in
// `.evals/passed.json` as having checked the agentic code as it was loaded,
// which answers the verification guard's eval check (`.agents/hooks/verification.mjs`).
startEvalRecording(join(HERE, '../..'), basename(dirname(process.argv[1] ?? '')));

// The repository root depends on none of these: take each from the
// workspace package that does, so the versions are the ones the API runs.
export const fromApi = createRequire(join(HERE, '../../apps/api/package.json'));
const fromAgents = createRequire(join(HERE, '../../packages/backend/agents/package.json'));

/** A tool as an eval serves it: what the model is shown, and what a call answers. */
export interface EvalTool {
  name: string;
  description: string;
  /** A JSON Schema for an object: the input the model is shown. */
  inputSchema: Record<string, unknown>;
  run(input: unknown): Promise<{ content: string; isError?: boolean }>;
}

/** One call the model made in a turn, with what it was answered. */
export interface TurnCall {
  tool: string;
  input: unknown;
  content: string;
  isError: boolean;
}

export interface Turn {
  /** Every call, in the order the model made them. */
  calls: TurnCall[];
  /** Everything the model wrote to the person in the turn, joined. */
  answer: string;
  /** Each block it wrote, with how many of `calls` had ended before it. */
  blocks: { text: string; after: number }[];
  /** Why the turn ended other than by answering: the cap, or a failure. */
  stopped?: string;
  /** How many times the model searched for a deferred tool (Claude Code's `ToolSearch`). */
  searches?: number;
  /** Tools the model called by the bare name, which Claude Code never ran ("No such tool"). */
  unprefixed?: string[];
}

export interface TurnRequest {
  system: string;
  message: string;
  tools: readonly EvalTool[];
  /** The most model calls (the Messages API) or turns (the Agent SDK's `maxTurns`). */
  maxTurns: number;
  maxTokens?: number;
  /** Sent on the Messages API path; the Agent SDK takes none, so it samples at its default. */
  temperature?: number;
  /**
   * A turn that grades another (a judge, a grader): run as the eval set it
   * up, never under `BOT_EVAL_ADVISOR` or `BOT_EVAL_EFFORT`, which are for
   * the bot's turns being compared.
   */
  grading?: boolean;
}

export interface Transport {
  engine: 'messages-api' | 'claude-code';
  model: string;
  turn(request: TurnRequest): Promise<Turn>;
}

/** The value after `--<name>` on the command line. */
export function arg(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
}

/**
 * The transport this machine can run: the Messages API when
 * `ANTHROPIC_API_KEY` is set, else the Agent SDK on the Claude Code login.
 */
export function transport(model: string): Transport {
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return apiKey
    ? { engine: 'messages-api', model, turn: messagesApi(apiKey, model) }
    : { engine: 'claude-code', model, turn: claudeCode(model) };
}

async function runCall(
  tools: readonly EvalTool[],
  name: string,
  input: unknown,
): Promise<TurnCall> {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) return { tool: name, input, content: `Unknown tool: ${name}`, isError: true };
  try {
    const result = await tool.run(input);
    return { tool: name, input, content: result.content, isError: result.isError === true };
  } catch (error) {
    return { tool: name, input, content: String(error), isError: true };
  }
}

const answerOf = (blocks: Turn['blocks']) => blocks.map((block) => block.text).join('\n');

function messagesApi(apiKey: string, model: string): Transport['turn'] {
  const AnthropicClient = (fromAgents('@anthropic-ai/sdk') as typeof import('@anthropic-ai/sdk'))
    .default;
  const client = new AnthropicClient({ apiKey });
  return async (request) => {
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: request.message }];
    const calls: TurnCall[] = [];
    const said: Turn['blocks'] = [];
    for (let turn = 1; turn <= request.maxTurns; turn++) {
      const response = await client.messages.create({
        model,
        max_tokens: request.maxTokens ?? 2048,
        ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
        system: request.system,
        tools: request.tools.map(
          (tool) =>
            ({
              name: tool.name,
              description: tool.description,
              input_schema: { type: 'object' as const, ...tool.inputSchema },
            }) satisfies Anthropic.Tool,
        ),
        messages,
      });
      for (const block of response.content)
        if (block.type === 'text') said.push({ text: block.text, after: calls.length });
      const uses = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
      );
      if (uses.length === 0) return { calls, answer: answerOf(said), blocks: said };
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const use of uses) {
        const made = await runCall(request.tools, use.name, use.input);
        calls.push(made);
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: made.content,
          is_error: made.isError,
        });
      }
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: results });
    }
    return { calls, answer: answerOf(said), blocks: said, stopped: 'max_turns' };
  };
}

/**
 * Claude Code's tool search for the eval's turns, from `BOT_EVAL_TOOL_SEARCH`:
 * `engine` (the default) defers the tools that may wait when the engine
 * would (`claudeToolSearch`: past `DEFER_TOOLS_ABOVE_CHARS` together),
 * `true` defers them whatever their size (the hardest case), `false` loads
 * them all, as before 2026-11-23.
 */
function toolSearchMode(): 'engine' | 'true' | 'false' {
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
  const mode = process.env.BOT_EVAL_TOOL_SEARCH ?? 'engine';
  if (mode !== 'engine' && mode !== 'true' && mode !== 'false') {
    throw new Error(`BOT_EVAL_TOOL_SEARCH is engine, true or false, not "${mode}".`);
  }
  return mode;
}

/** The tools the engine never defers (`alwaysLoaded`): the bot's own, and those a built-in skill calls. */
function ownToolNames(): ReadonlySet<string> {
  const none = undefined as never;
  return alwaysLoaded([
    new BotSelfToolsFactory(none, none, none),
    new BotSkillToolsFactory(none, none),
    new BotGuideToolsFactory(none),
    new BotGoalToolsFactory(none, none),
    new BotLoopToolsFactory(none, none),
    new BotQuestionToolsFactory(none, none),
    new BotNoticeToolsFactory(none, none),
    new BotCheckBackToolsFactory(none, none),
    new BotVisualToolsFactory(none),
    new BotFormToolsFactory(none, none),
  ]);
}

function claudeCode(model: string): Transport['turn'] {
  const { query } = fromAgents(
    '@anthropic-ai/claude-agent-sdk',
  ) as typeof import('@anthropic-ai/claude-agent-sdk');
  const { McpServer } = fromAgents(
    '@modelcontextprotocol/sdk/server/mcp.js',
  ) as typeof import('@modelcontextprotocol/sdk/server/mcp.js');
  const { CallToolRequestSchema, ListToolsRequestSchema } = fromAgents(
    '@modelcontextprotocol/sdk/types.js',
  ) as typeof import('@modelcontextprotocol/sdk/types.js');

  return async (request) => {
    const calls: TurnCall[] = [];
    const said: Turn['blocks'] = [];
    // The tool server the Claude engine builds (`claude-tool-server.ts`):
    // our tools as `mcp__oppenheimer__<name>`, schemas served as they are.
    const mcp = new McpServer(
      { name: 'oppenheimer', version: '1.0.0' },
      { capabilities: { tools: {} } },
    );
    // As the engine marks them (`BotToolboxFactory`): the bot's own tools are
    // always loaded, a capability's may wait behind Claude Code's tool search.
    const own = ownToolNames();
    const search = toolSearchMode();
    const waiting = request.tools.filter((tool) => !own.has(tool.name));
    const size = waiting.reduce(
      (sum, tool) =>
        sum + tool.name.length + tool.description.length + JSON.stringify(tool.inputSchema).length,
      0,
    );
    const deferring =
      waiting.length > 0 &&
      (search === 'true' || (search === 'engine' && size > DEFER_TOOLS_ABOVE_CHARS));
    mcp.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: request.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: { type: 'object' as const, ...tool.inputSchema },
        ...(deferring && !own.has(tool.name) ? {} : { _meta: { 'anthropic/alwaysLoad': true } }),
      })),
    }));
    mcp.server.setRequestHandler(CallToolRequestSchema, async (received) => {
      const made = await runCall(
        request.tools,
        received.params.name,
        received.params.arguments ?? {},
      );
      calls.push(made);
      return { content: [{ type: 'text' as const, text: made.content }], isError: made.isError };
    });
    // A grading turn runs as the eval set it up; only the bot's turns are compared.
    const advisor = request.grading ? undefined : EVAL_ADVISOR;
    const effort = request.grading ? undefined : EVAL_EFFORT;
    const cwd = mkdtempSync(join(tmpdir(), 'bot-eval-'));
    let stopped: string | undefined;
    let searches = 0;
    const unprefixed: string[] = [];
    try {
      for await (const message of query({
        prompt: request.message,
        options: {
          model,
          // As the engine sends it (`claudeSystemPrompt`): how to call the tools on Claude Code.
          systemPrompt: claudeSystemPrompt({
            systemPrompt:
              advisor && EVAL_ADVISOR_NUDGE
                ? `${request.system}\n\n${ADVISOR_NUDGE}`
                : request.system,
            tools: request.tools,
          }),
          cwd,
          tools: deferring ? ['ToolSearch'] : [],
          allowedTools: [
            ...request.tools.map((tool) => `mcp__oppenheimer__${tool.name}`),
            ...(deferring ? ['ToolSearch'] : []),
          ],
          env: {
            ...process.env,
            ENABLE_TOOL_SEARCH: deferring ? 'true' : 'false',
            ...(advisor ? { CLAUDE_CODE_ENABLE_EXPERIMENTAL_ADVISOR_TOOL: '1' } : {}),
          },
          ...(advisor ? { settings: { advisorModel: advisor } } : {}),
          ...(effort ? { effort } : {}),
          permissionMode: 'dontAsk',
          mcpServers: { oppenheimer: { type: 'sdk', name: 'oppenheimer', instance: mcp } },
          strictMcpConfig: true,
          settingSources: [],
          persistSession: false,
          maxTurns: request.maxTurns,
        },
      })) {
        if (message.type === 'assistant') {
          for (const block of message.message.content) {
            if (block.type === 'text') said.push({ text: block.text, after: calls.length });
            if (block.type === 'tool_use' && block.name === 'ToolSearch') searches++;
            // A call by the bare name never reaches the tool server: Claude Code
            // answers it "No such tool". Kept apart, so a run can tell it from silence.
            if (
              block.type === 'tool_use' &&
              block.name !== 'ToolSearch' &&
              !block.name.startsWith('mcp__')
            ) {
              unprefixed.push(block.name);
            }
          }
        } else if (message.type === 'result') {
          tally(message.modelUsage);
          if (message.subtype !== 'success') stopped = message.subtype;
        }
      }
    } catch (error) {
      stopped = String(error);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
    return {
      calls,
      answer: answerOf(said),
      blocks: said,
      searches,
      ...(unprefixed.length > 0 ? { unprefixed } : {}),
      ...(stopped ? { stopped } : {}),
    };
  };
}

/**
 * Set-ups an eval can be run under on the Claude Code login, to compare
 * them on the same cases: `BOT_EVAL_ADVISOR` gives the turn an advisor
 * (Claude Code's `advisorModel`, with the gate the engine opens), and
 * `BOT_EVAL_EFFORT` an effort level. Either set, the run ends with what each
 * model spent, the advisor's apart.
 */
// biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
const EVAL_ADVISOR = process.env.BOT_EVAL_ADVISOR;
// biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
const EVAL_EFFORT = process.env.BOT_EVAL_EFFORT as
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max'
  | undefined;
/**
 * `BOT_EVAL_ADVISOR_NUDGE`: with an advisor, one line more in the bot's
 * system prompt telling it to consult the advisor before it acts, to
 * measure whether advice it is made to ask for changes what it gets right.
 */
// biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
const EVAL_ADVISOR_NUDGE = process.env.BOT_EVAL_ADVISOR_NUDGE === '1';
const ADVISOR_NUDGE =
  'You have an advisor. Before you take an action that changes something (a merge, a session, a message sent, a look set or not set), call the advisor once with what you plan to do, and weigh its answer.';
const spent = new Map<string, { turns: number; input: number; output: number; usd: number }>();

function tally(usage: Record<string, unknown> | undefined): void {
  for (const [model, raw] of Object.entries(usage ?? {})) {
    const counts = raw as {
      inputTokens: number;
      outputTokens: number;
      cacheReadInputTokens: number;
      cacheCreationInputTokens: number;
      costUSD: number;
    };
    const row = spent.get(model) ?? { turns: 0, input: 0, output: 0, usd: 0 };
    row.turns += 1;
    row.input += counts.inputTokens + counts.cacheReadInputTokens + counts.cacheCreationInputTokens;
    row.output += counts.outputTokens;
    row.usd += counts.costUSD;
    spent.set(model, row);
  }
}

if (EVAL_ADVISOR || EVAL_EFFORT) {
  process.on('exit', () => {
    const setup = [
      EVAL_EFFORT && `effort ${EVAL_EFFORT}`,
      EVAL_ADVISOR && `advisor ${EVAL_ADVISOR}`,
    ]
      .filter(Boolean)
      .join(', ');
    console.log(`\nSpent (${setup}):`);
    for (const [model, row] of spent) {
      console.log(
        `  ${model.padEnd(20)} ${row.turns} runs  ${row.input} in  ${row.output} out  $${row.usd.toFixed(3)} at list`,
      );
    }
  });
}

/** Runs `work` over `items`, at most `limit` at a time, in order. */
export async function pool<T, R>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const at = next++;
      results[at] = await work(items[at] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Writes `data` to `<dir>/reports/<now>.json` and says where. */
export function writeReport(dir: string, data: unknown): string {
  mkdirSync(join(dir, 'reports'), { recursive: true });
  const report = join(dir, 'reports', `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(report, `${JSON.stringify(data, null, 2)}\n`);
  return report;
}
