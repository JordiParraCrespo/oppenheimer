#!/usr/bin/env -S pnpm exec tsx
// A new bot's first chat: does it ask what to call it and what its job is,
// say what it can do only as far as its tools act, and put work the first
// message asks for first?
//
// While a bot's INSTRUCTIONS.md is empty its prompt carries Getting started
// (`gettingStarted` in `apps/api/src/bots-chat/domain/bot-prompt.policy.ts`,
// `25-bots.md` §1): work the message asks for first, then the name and the
// job; a list of what it can do from `AREA_INTROS`, only for areas whose
// acting tools the turn offers; job examples from the same table. A change
// to those, or to the default soul (`botSoulFor`), is what this eval is for.
//
// Each case in `cases.json` is one first message to Juno, a new bot, with a
// set of tools. The runner builds the real system prompt and soul, serves
// the tools as stubs (`list_hosts` answers that no host is paired), and has
// a grader, on the same model, answer yes or no to each question the case
// cares about. Calls are scored as made.
//
//   pnpm eval:bot-first-chat                     every case, 3 runs each
//   pnpm eval:bot-first-chat --case read-only    one case
//   pnpm eval:bot-first-chat --runs 5
//   env: BOT_FIRST_CHAT_EVAL_MODEL (default claude-sonnet-5-5)
//        ANTHROPIC_API_KEY: with it, the Messages API; without it, the
//        machine's Claude Code login, through the Agent SDK
//
// A case passes when it is right on a majority of its runs; the eval exits 1
// when any case fails. Every run's reply, calls and grades go to `reports/`.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REMEMBER_DESCRIPTION,
  REMEMBER_MEMORY,
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

const HERE = dirname(fileURLToPath(import.meta.url));
const { botSoulFor } = fromApi('@oppenheimer/shared') as typeof import('@oppenheimer/shared');

/** What the grader is asked about a reply, by the key a case names. */
const QUESTIONS = {
  asksName: 'Does the reply ask the person what they would like to call the bot?',
  asksJob: 'Does the reply ask the person what job or task they want the bot to own?',
  listsCapabilities: 'Does the reply list several things the bot can do for the person?',
  promisesSessions:
    "Does the reply say the bot can start coding agents or sessions, or run commands, on the person's computers?",
  suggestsCodingAgents:
    'Does the reply suggest, as an example job, running coding agents (on a host or anywhere)?',
  answersQuestion: 'Does the reply answer the question the person asked (which hosts they have)?',
  spanish: 'Is the reply written in Spanish?',
} as const;
type Question = keyof typeof QUESTIONS;

interface StubTool {
  name: string;
  group: string;
  description?: string;
}
interface Case {
  id: string;
  toolset: string;
  message: string;
  instructions?: string;
  want: Partial<Record<Question, boolean>>;
  wantCalls?: string[];
  wantGeneralMemory?: boolean;
}
interface Cases {
  bot: { name: string };
  toolsets: Record<string, StubTool[]>;
  cases: Case[];
}

const REMEMBER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['fact'],
  properties: {
    fact: { type: 'string' },
    tier: { type: 'string', enum: ['profile', 'log'] },
    memory: { type: 'string', enum: [...REMEMBER_MEMORY] },
  },
};
const EMPTY_SCHEMA = { type: 'object', additionalProperties: true, properties: {} };

function stubTools(tools: readonly StubTool[]): EvalTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.name === 'remember' ? REMEMBER_DESCRIPTION : (tool.description ?? ''),
    inputSchema: tool.name === 'remember' ? REMEMBER_SCHEMA : EMPTY_SCHEMA,
    run: async () => ({
      content:
        tool.name === 'list_hosts'
          ? 'No hosts paired yet.'
          : tool.name === 'remember'
            ? 'Saved.'
            : 'Done.',
    }),
  }));
}

const GRADER = `You grade one reply a chat bot wrote to a person. Answer each numbered question about the reply with true or false, judging only what the reply itself says. Answer with one JSON object and nothing else, its keys the question keys, its values true or false.`;

async function grade(
  via: Transport,
  reply: string,
  keys: readonly Question[],
): Promise<Record<string, boolean>> {
  const message = `The reply:\n<reply>\n${reply}\n</reply>\n\nQuestions:\n${keys.map((key) => `- ${key}: ${QUESTIONS[key]}`).join('\n')}`;
  const turn = await via.turn({ system: GRADER, message, tools: [], maxTurns: 1 });
  const json = turn.answer.match(/\{[\s\S]*\}/)?.[0];
  return json ? (JSON.parse(json) as Record<string, boolean>) : {};
}

async function runOnce(via: Transport, data: Cases, item: Case) {
  const stubs = data.toolsets[item.toolset] ?? [];
  const tools = stubTools(stubs);
  const system = composeBotSystemPrompt({
    name: data.bot.name,
    description: '',
    soul: botSoulFor(data.bot.name),
    instructions: item.instructions ?? '',
    facts: [],
    engineCapabilities: [],
    tools: stubs.map((stub, i) => ({
      name: stub.name,
      description: tools[i].description,
      group: stub.group as never,
    })),
  });
  const turn = await via.turn({ system, message: item.message, tools, maxTurns: 6 });
  const keys = Object.keys(item.want) as Question[];
  const grades = keys.length ? await grade(via, turn.answer, keys) : {};
  const misses = keys.filter((key) => grades[key] !== item.want[key]);
  const called = new Set(turn.calls.map((call) => call.tool));
  for (const name of item.wantCalls ?? [])
    if (!called.has(name)) misses.push(`called ${name}` as never);
  if (item.wantGeneralMemory) {
    const general = turn.calls.some(
      (call) =>
        call.tool === 'remember' &&
        (call.input as { memory?: string } | undefined)?.memory === 'general',
    );
    if (!general) misses.push('saved to the general memory' as never);
  }
  return {
    right: misses.length === 0,
    misses,
    grades,
    calls: turn.calls,
    answer: turn.answer,
    stopped: turn.stopped,
  };
}

async function main(): Promise<void> {
  const data = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8')) as Cases;
  const only = arg('case');
  const runs = Number(arg('runs') ?? 3);
  const cases = data.cases.filter((item) => !only || item.id === only);
  if (cases.length === 0) throw new Error(`No case named ${only}`);
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
  const via = transport(process.env.BOT_FIRST_CHAT_EVAL_MODEL ?? 'claude-sonnet-5-5');
  const jobs = cases.flatMap((item) => Array.from({ length: runs }, () => item));
  const results = await pool(jobs, 4, (item) =>
    runOnce(via, data, item).then((run) => ({ id: item.id, ...run })),
  );
  let failed = 0;
  for (const item of cases) {
    const mine = results.filter((run) => run.id === item.id);
    const right = mine.filter((run) => run.right).length;
    const pass = right * 2 > mine.length;
    if (!pass) failed += 1;
    const misses = [...new Set(mine.flatMap((run) => run.misses))];
    console.log(
      `${pass ? 'pass' : 'FAIL'}  ${item.id.padEnd(14)} ${right}/${mine.length}${misses.length ? `  missed: ${misses.join(', ')}` : ''}`,
    );
  }
  const right = results.filter((run) => run.right).length;
  console.log(
    `\n${via.model} (${via.engine}): ${right}/${results.length} runs right; ${failed} of ${cases.length} cases failed.`,
  );
  console.log(`Report: ${writeReport(HERE, { model: via.model, engine: via.engine, results })}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
