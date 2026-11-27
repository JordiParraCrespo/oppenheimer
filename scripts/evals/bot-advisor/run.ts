#!/usr/bin/env -S pnpm exec tsx
// A bot sets its own advisor when the person asks (2026-11-27): "give
// yourself Opus 5.5 as your advisor" is an update_bot call that names it, and
// "turn your advisor off" is one that clears it, never an answer that it
// cannot, or a change of its model instead.
//
// What it measures is update_bot's description and inputs
// (`bots/tools.update-bot*`). Each case is one message to a Sonnet 5.5 bot;
// the runner serves update_bot with its production description and schema,
// and get_self, as stubs that answer as production does, and runs one turn.
//
// A run is right when it calls update_bot for the bot itself, ends with the
// advisor the case expects (by id or label, as the stub keeps it), and no
// call in it changes the bot's model or provider. One miss fails its case.
//
//   pnpm eval:bot-advisor                every case, 3 runs each
//   pnpm eval:bot-advisor --case set --runs 1
//   env: BOT_ADVISOR_EVAL_MODEL (default claude-sonnet-5-5)
//        ANTHROPIC_API_KEY: with it, the Messages API; without it, the
//        machine's Claude Code login, through the Agent SDK
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { composeBotSystemPrompt } from '../../../apps/api/src/bots-chat/domain/bot-prompt.policy';
import { promptText } from '../../../apps/api/src/bots-chat/domain/bot-prompt-text.policy';
import {
  composeTurnContext,
  withTurnContext,
} from '../../../apps/api/src/bots-chat/domain/bot-turn-context.policy';
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

interface Case {
  id: string;
  message: string;
  advisorBefore?: string | null;
  advisor: string | null;
}
interface Cases {
  bot: { name: string; id: string; model: string };
  cases: Case[];
}

/** The labels a model id is also known by, as the catalog draws them. */
const LABELS: Record<string, string> = { 'claude-opus-5-5': 'Opus 5.5' };

/** The bot's advisor as a run changes it, so a read after the update sees it, as in production. */
interface RunState {
  advisor: string | null;
}

function updateBot(state: RunState): EvalTool {
  return {
    name: 'update_bot',
    description: promptText('bots/tools.update-bot', { updateMax: '20' }),
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['bot_ids'],
      properties: {
        bot_ids: {
          type: 'array',
          items: { type: 'string' },
          description: promptText('bots/tools.update-bot-bot-ids'),
        },
        provider: { type: 'string', description: promptText('bots/tools.update-bot-provider') },
        model: { type: ['string', 'null'], description: promptText('bots/tools.update-bot-model') },
        effort: {
          type: ['string', 'null'],
          description: promptText('bots/tools.create-bot-effort'),
        },
        advisor_model: {
          type: ['string', 'null'],
          description: promptText('bots/tools.update-bot-advisor-model'),
        },
        permission: { type: 'string', description: promptText('bots/tools.update-bot-permission') },
      },
    },
    run: async (input) => {
      const advisor = advisorOf(input);
      if (advisor !== undefined) state.advisor = advisor;
      return { content: 'Updated 1 bot.' };
    },
  };
}

function getSelf(data: Cases, state: RunState): EvalTool {
  return {
    name: 'get_self',
    description: 'Reads your own settings: your id, provider, model, effort and the rest.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    run: async () => ({
      content: [
        `- id: ${data.bot.id}`,
        `- name: ${data.bot.name}`,
        `- provider: anthropic; model: Sonnet 5.5; effort: auto, runs at medium`,
        `- advisor: ${state.advisor ? `${LABELS[state.advisor] ?? state.advisor} (${state.advisor})` : 'none (its model takes Fable 5.2, Fable 5.1, Fable 5, Opus 5.5, Opus 5)'}`,
      ].join('\n'),
    }),
  };
}

function advisorOf(input: unknown): string | null | undefined {
  const value = (input as { advisor_model?: unknown } | undefined)?.advisor_model;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  return Object.entries(LABELS).find(([, label]) => label === value)?.[0] ?? value;
}

async function runOnce(via: Transport, data: Cases, item: Case) {
  const state: RunState = { advisor: item.advisorBefore ?? null };
  const tools = [getSelf(data, state), updateBot(state)];
  const system = composeBotSystemPrompt({
    name: data.bot.name,
    description: 'Helps the person run their engineering work.',
    soul: botSoulFor(data.bot.name),
    instructions: 'Keep the person on top of their open pull requests.',
    facts: [],
    personFacts: [],
    engineCapabilities: [],
    tools: tools.map((tool) => ({ name: tool.name, description: tool.description, group: 'self' })),
  });
  const context = composeTurnContext({
    now: new Date('2026-11-27T09:30:00Z'),
    timeZone: 'Europe/Madrid',
    homeHost: null,
    hosts: [],
    lastContext: null,
  });
  const turn = await via.turn({
    system,
    message: withTurnContext(context, item.message),
    tools,
    maxTurns: 5,
  });
  const updates = turn.calls.filter((call) => call.tool === 'update_bot');
  // Judged by where the run ends, not by one good call: setting the advisor
  // and then clearing it is wrong, and so is any call that moves the engine.
  const forSelf = updates.some((call) => {
    const ids = (call.input as { bot_ids?: unknown }).bot_ids;
    return Array.isArray(ids) && ids.includes(data.bot.id);
  });
  const engineMoved = updates.some((call) => {
    const input = call.input as { model?: unknown; provider?: unknown };
    return input.model !== undefined || input.provider !== undefined;
  });
  const right = forSelf && !engineMoved && state.advisor === item.advisor;
  return { right, calls: turn.calls, answer: turn.answer, stopped: turn.stopped };
}

async function main(): Promise<void> {
  const data = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8')) as Cases;
  const only = arg('case');
  const runs = Number(arg('runs') ?? 3);
  const cases = data.cases.filter((item) => !only || item.id === only);
  if (cases.length === 0) throw new Error(`No case named ${only}`);
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
  const via = transport(process.env.BOT_ADVISOR_EVAL_MODEL ?? 'claude-sonnet-5-5');
  const jobs = cases.flatMap((item) => Array.from({ length: runs }, () => item));
  const results = await pool(jobs, 4, (item) =>
    runOnce(via, data, item).then((run) => ({ id: item.id, ...run })),
  );
  let failed = 0;
  for (const item of cases) {
    const mine = results.filter((run) => run.id === item.id);
    const right = mine.filter((run) => run.right).length;
    const pass = right === mine.length;
    if (!pass) failed += 1;
    console.log(`${pass ? 'pass' : 'FAIL'}  ${item.id.padEnd(10)} ${right}/${mine.length} right`);
    for (const run of mine) {
      const calls = run.calls
        .map((call) => `${call.tool}(${JSON.stringify(call.input)})`)
        .join(' ');
      console.log(`      ${calls || '(no call)'} -> ${JSON.stringify(run.answer).slice(0, 160)}`);
    }
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
