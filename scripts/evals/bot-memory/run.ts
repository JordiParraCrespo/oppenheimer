#!/usr/bin/env -S pnpm exec tsx
// Does a bot write each fact to the right memory?
//
// A bot keeps two memories: its own, which only it reads, and the general
// one about the person, which every bot of theirs reads. A fact filed in the
// general memory by mistake lands in the prompt of bots whose job it is not
// (a project, a folder, a notification setting); one filed in the bot's own
// memory by mistake makes the other bots ask again.
//
// Each case in `cases.json` is one bot (its name, description and
// INSTRUCTIONS.md) and one message from the person that holds one fact worth
// saving. The runner builds the bot's real system prompt
// (`composeBotSystemPrompt`), offers the real `remember` tool (its
// description and input hints from `bot-memory.policy.ts`), lets the model
// answer the message, and checks the `memory` of every `remember` call it
// made against `expect` (`rightRun`): a general fact must reach the general
// memory, and a fact for the bot's own must not.
//
//   pnpm eval:bot-memory                     every case, 3 runs each
//   pnpm eval:bot-memory --case squash       one case
//   pnpm eval:bot-memory --runs 5
//   env: BOT_MEMORY_EVAL_MODEL (default claude-sonnet-5-5)
//        ANTHROPIC_API_KEY: with it, the Messages API; without it, the
//        machine's Claude Code login, through the Agent SDK as the Claude
//        bot engine runs a turn (`packages/backend/agents/src/claude`)
//
// It passes when every case is right on a majority of its runs. The full
// answers go to `reports/`.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Anthropic from '@anthropic-ai/sdk';
import {
  REMEMBER_DESCRIPTION,
  REMEMBER_MEMORY,
  REMEMBER_MEMORY_HINT,
  REMEMBER_TIER_HINT,
} from '../../../apps/api/src/bots-chat/domain/bot-memory.policy';
import { composeBotSystemPrompt } from '../../../apps/api/src/bots-chat/domain/bot-prompt.policy';

type Memory = (typeof REMEMBER_MEMORY)[number];

interface Bot {
  name: string;
  description: string;
  instructions: string;
  /** What it already keeps in its own memory, so the prompt has a *Your memory* section. */
  memory: string[];
}

interface Case {
  id: string;
  bot: string;
  message: string;
  expect: Memory;
  why: string;
}

interface Save {
  /** `invalid` when the model sent a value the tool refuses: nothing would be saved. */
  memory: Memory | 'invalid';
  fact: string;
  tier: string;
}

type Ask = (bot: Bot, general: string[], message: string) => Promise<Save[]>;

const HERE = dirname(fileURLToPath(import.meta.url));
const MAX_PARALLEL = 6;

// The repository root depends on none of these: take each from the
// workspace package that does, so the versions are the ones the API runs.
const fromApi = createRequire(join(HERE, '../../../apps/api/package.json'));
const fromAgents = createRequire(join(HERE, '../../../packages/backend/agents/package.json'));
const { BOT_MEMORY_FACT_MAX, BOT_MEMORY_TIERS } = fromApi(
  '@oppenheimer/shared',
) as typeof import('@oppenheimer/shared');

function arg(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
}

const REMEMBER_SCHEMA = {
  type: 'object' as const,
  additionalProperties: false,
  required: ['fact'],
  properties: {
    fact: {
      type: 'string',
      maxLength: BOT_MEMORY_FACT_MAX,
      description: 'The fact, as one self-contained sentence.',
    },
    tier: { type: 'string', enum: [...BOT_MEMORY_TIERS], description: REMEMBER_TIER_HINT },
    memory: { type: 'string', enum: [...REMEMBER_MEMORY], description: REMEMBER_MEMORY_HINT },
  },
};

function systemPrompt(bot: Bot, general: string[]): string {
  return composeBotSystemPrompt({
    name: bot.name,
    description: bot.description,
    soul: '',
    instructions: bot.instructions,
    facts: bot.memory,
    personFacts: general,
    engineCapabilities: [],
    tools: [{ name: 'remember', description: REMEMBER_DESCRIPTION }],
  });
}

/** What `remember` saves from its input: the bot's own memory when none is named. */
function saveOf(input: unknown): Save {
  const { fact, tier, memory } = (input ?? {}) as Partial<Record<keyof Save, string>>;
  return {
    memory:
      memory === undefined
        ? 'yours'
        : (REMEMBER_MEMORY as readonly string[]).includes(memory)
          ? (memory as Memory)
          : 'invalid',
    fact: fact ?? '',
    tier: tier ?? 'log',
  };
}

function messagesApi(apiKey: string, model: string): Ask {
  const AnthropicClient = (fromAgents('@anthropic-ai/sdk') as typeof import('@anthropic-ai/sdk'))
    .default;
  const client = new AnthropicClient({ apiKey });
  return async (bot, general, message) => {
    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      system: systemPrompt(bot, general),
      tools: [
        {
          name: 'remember',
          description: REMEMBER_DESCRIPTION,
          input_schema: REMEMBER_SCHEMA,
        } satisfies Anthropic.Tool,
      ],
      messages: [{ role: 'user', content: message }],
    });
    return response.content
      .filter((block) => block.type === 'tool_use' && block.name === 'remember')
      .map((block) => saveOf((block as Anthropic.ToolUseBlock).input));
  };
}

function claudeCode(model: string): Ask {
  const { query } = fromAgents(
    '@anthropic-ai/claude-agent-sdk',
  ) as typeof import('@anthropic-ai/claude-agent-sdk');
  const { McpServer } = fromAgents(
    '@modelcontextprotocol/sdk/server/mcp.js',
  ) as typeof import('@modelcontextprotocol/sdk/server/mcp.js');
  const { CallToolRequestSchema, ListToolsRequestSchema } = fromAgents(
    '@modelcontextprotocol/sdk/types.js',
  ) as typeof import('@modelcontextprotocol/sdk/types.js');

  return async (bot, general, message) => {
    const saves: Save[] = [];
    // The tool server the Claude engine builds (`claude-tool-server.ts`):
    // our tools as `mcp__oppenheimer__<name>`, schemas served as they are.
    const mcp = new McpServer(
      { name: 'oppenheimer', version: '1.0.0' },
      { capabilities: { tools: {} } },
    );
    mcp.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'remember',
          description: REMEMBER_DESCRIPTION,
          inputSchema: REMEMBER_SCHEMA,
          _meta: { 'anthropic/alwaysLoad': true },
        },
      ],
    }));
    mcp.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const save = saveOf(request.params.arguments);
      saves.push(save);
      if (save.memory === 'invalid') {
        return {
          content: [
            { type: 'text' as const, text: 'Invalid input: memory must be "yours" or "general".' },
          ],
          isError: true,
        };
      }
      const where = save.memory === 'general' ? 'general memory' : 'your memory';
      return {
        content: [{ type: 'text' as const, text: `Remembered (${where}): "${save.fact}".` }],
      };
    });
    const cwd = mkdtempSync(join(tmpdir(), 'bot-memory-eval-'));
    try {
      for await (const _ of query({
        prompt: message,
        options: {
          model,
          systemPrompt: systemPrompt(bot, general),
          cwd,
          tools: [],
          allowedTools: ['mcp__oppenheimer__remember'],
          permissionMode: 'dontAsk',
          mcpServers: { oppenheimer: { type: 'sdk', name: 'oppenheimer', instance: mcp } },
          strictMcpConfig: true,
          settingSources: [],
          persistSession: false,
          maxTurns: 4,
        },
      })) {
        // Only the tool calls matter; the reply is not scored.
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
    return saves;
  };
}

/**
 * A general fact is right once it reaches the general memory, even beside a
 * note of the bot's own about what it means for its job; a fact for the
 * bot's own memory is right when it is saved and nothing reaches the general
 * one. A value the tool refuses is never right.
 */
function rightRun(saves: Save[], expect: Memory): boolean {
  if (saves.some((save) => save.memory === 'invalid')) return false;
  if (expect === 'general') return saves.some((save) => save.memory === 'general');
  return saves.length > 0 && saves.every((save) => save.memory === 'yours');
}

/** Runs `work` over `items`, at most `limit` at a time, in order. */
async function pool<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
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

async function main(): Promise<void> {
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
  const model = process.env.BOT_MEMORY_EVAL_MODEL ?? 'claude-sonnet-5-5';
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: as above.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const engine = apiKey ? 'messages-api' : 'claude-code';
  const ask = apiKey ? messagesApi(apiKey, model) : claudeCode(model);
  const runs = Number(arg('runs') ?? 3);
  const only = arg('case');
  const { general, bots, cases } = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8')) as {
    general: string[];
    bots: Record<string, Bot>;
    cases: Case[];
  };
  const chosen = cases.filter((c) => !only || c.id === only);
  if (chosen.length === 0) throw new Error(`No case "${only}".`);

  const jobs = chosen.flatMap((c) => Array.from({ length: runs }, () => c));
  const answers = await pool(jobs, MAX_PARALLEL, (c) => {
    const bot = bots[c.bot];
    if (!bot) throw new Error(`Case ${c.id} names no bot "${c.bot}".`);
    return ask(bot, general, c.message);
  });
  const results = chosen.map((c, i) => {
    const saves = answers.slice(i * runs, (i + 1) * runs);
    const right = saves.filter((s) => rightRun(s, c.expect)).length;
    return { ...c, saves, right, passed: right * 2 > runs };
  });

  const width = Math.max(...results.map((r) => r.id.length));
  const mark = (s: Save[]) =>
    s.length === 0
      ? '-'
      : s.map((x) => ({ general: 'G', yours: 'Y', invalid: '?' })[x.memory]).join('');
  for (const r of results) {
    console.log(
      `${r.passed ? 'pass' : 'FAIL'}  ${r.id.padEnd(width)}  want ${r.expect.padEnd(7)}  got ${r.saves.map(mark).join(' ')}  ${r.right}/${runs}`,
    );
    if (!r.passed) {
      for (const save of r.saves.flat()) console.log(`        ${save.memory}: ${save.fact}`);
    }
  }
  const total = results.length * runs;
  const right = results.reduce((sum, r) => sum + r.right, 0);
  const leaked = results
    .filter((r) => r.expect === 'yours')
    .reduce(
      (sum, r) => sum + r.saves.filter((s) => s.some((x) => x.memory === 'general')).length,
      0,
    );
  const unsaved = results.reduce((sum, r) => sum + r.saves.filter((s) => s.length === 0).length, 0);
  const failed = results.filter((r) => !r.passed).length;
  console.log(
    `\n${model} (${engine}): ${right}/${total} runs right, ${leaked} leaked a job fact to the general memory, ${unsaved} saved nothing; ${failed} of ${results.length} cases failed.`,
  );

  mkdirSync(join(HERE, 'reports'), { recursive: true });
  const report = join(HERE, 'reports', `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(report, `${JSON.stringify({ model, engine, runs, results }, null, 2)}\n`);
  console.log(`Report: ${report}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(2);
});
