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
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REMEMBER_DESCRIPTION,
  REMEMBER_MEMORY,
  REMEMBER_MEMORY_HINT,
  REMEMBER_TIER_HINT,
} from '../../../apps/api/src/bots-chat/domain/bot-memory.policy';
import { composeBotSystemPrompt } from '../../../apps/api/src/bots-chat/domain/bot-prompt.policy';
import {
  arg,
  type EvalTool,
  fromApi,
  pool,
  type Transport,
  transport,
  writeReport,
} from '../bot-turn';

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
  /** `invalid` when the tool would refuse the input: nothing would be saved. */
  memory: Memory | 'invalid';
  fact: string;
  tier: string;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const MAX_PARALLEL = 6;

const { BOT_MEMORY_FACT_MAX, BOT_MEMORY_TIERS } = fromApi(
  '@oppenheimer/shared',
) as typeof import('@oppenheimer/shared');
const { z } = fromApi('zod') as typeof import('zod');

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

/**
 * The input `remember` accepts, as `BotSelfToolsFactory.remember()` declares
 * it: an input it refuses saves nothing, so it must not score as a save.
 */
const REMEMBER_INPUT = z.strictObject({
  fact: z.string().trim().min(1).max(BOT_MEMORY_FACT_MAX),
  tier: z.enum(BOT_MEMORY_TIERS).optional(),
  memory: z.enum(REMEMBER_MEMORY).optional(),
});

/** What `remember` saves from its input: the bot's own memory when none is named. */
function saveOf(input: unknown): Save {
  const parsed = REMEMBER_INPUT.safeParse(input ?? {});
  if (!parsed.success) {
    const fact = (input as { fact?: unknown } | undefined)?.fact;
    return { memory: 'invalid', fact: typeof fact === 'string' ? fact : '', tier: '' };
  }
  const { fact, tier, memory } = parsed.data;
  return { memory: memory ?? 'yours', fact, tier: tier ?? 'log' };
}

/**
 * One turn with `remember` offered: every call it made, as what it would
 * save. The Messages API answers once, as the eval always has; the Agent SDK
 * runs its own loop, up to 4 turns.
 */
async function ask(via: Transport, bot: Bot, general: string[], message: string): Promise<Save[]> {
  const saves: Save[] = [];
  const remember: EvalTool = {
    name: 'remember',
    description: REMEMBER_DESCRIPTION,
    inputSchema: REMEMBER_SCHEMA,
    run: async (input) => {
      const save = saveOf(input);
      saves.push(save);
      if (save.memory === 'invalid') {
        return { content: 'Invalid input: nothing was saved.', isError: true };
      }
      const where = save.memory === 'general' ? 'general memory' : 'your memory';
      return { content: `Remembered (${where}): "${save.fact}".` };
    },
  };
  await via.turn({
    system: systemPrompt(bot, general),
    message,
    tools: [remember],
    maxTurns: via.engine === 'messages-api' ? 1 : 4,
  });
  return saves;
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

async function main(): Promise<void> {
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
  const via = transport(process.env.BOT_MEMORY_EVAL_MODEL ?? 'claude-sonnet-5-5');
  const { model, engine } = via;
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
    return ask(via, bot, general, c.message);
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
  const doubled = results
    .filter((r) => r.expect === 'general')
    .reduce(
      (sum, r) =>
        sum +
        r.saves.filter(
          (s) => s.some((x) => x.memory === 'general') && s.some((x) => x.memory === 'yours'),
        ).length,
      0,
    );
  const failed = results.filter((r) => !r.passed).length;
  console.log(
    `\n${model} (${engine}): ${right}/${total} runs right, ${leaked} leaked a job fact to the general memory, ${unsaved} saved nothing, ${doubled} kept a general fact in both memories; ${failed} of ${results.length} cases failed.`,
  );

  console.log(`Report: ${writeReport(HERE, { model, engine, runs, results })}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(2);
});
