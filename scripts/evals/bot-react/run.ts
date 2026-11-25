#!/usr/bin/env -S pnpm exec tsx
// A reaction comes with words: when a bot reacts to a short message from the
// person ("okeys!", "thanks!!", good news, a joke), it also writes a short
// line, never the emoji alone. The owner asked for this on 2026-11-25 after a
// bot answered "okeys!" with a lone 👍.
//
// What it measures is the `react` tool's description
// (`core/tools-self.react`) and the reaction line of
// `core/system-how-a-turn-goes`. Each case is the bot's last message and the
// person's short answer to it. The runner builds the real system prompt,
// serves `react` with its production description and schema as a stub that
// answers as production does, and runs one turn.
//
// A run is right when its reply has words: a reaction alone, or an empty
// reply, is a miss. Reacting is not required; replying in words only is right.
//
//   pnpm eval:bot-react                  every case, 3 runs each
//   pnpm eval:bot-react --case okeys --runs 1
//   env: BOT_REACT_EVAL_MODEL (default claude-sonnet-5-5)
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
  history: string;
  message: string;
}
interface Cases {
  bot: { name: string };
  cases: Case[];
}

const MESSAGE_ID = '0b9a3c52-6f0e-4c1a-9d5e-2f7f1c8a4e10';

const REACT: EvalTool = {
  name: 'react',
  description: promptText('core/tools-self.react'),
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['emoji'],
    properties: {
      emoji: { type: 'string', description: promptText('core/tools-self.react-emoji') },
      message_id: { type: 'string', description: promptText('core/tools-self.react-message-id') },
    },
  },
  run: async (input) => {
    const emoji = String((input as { emoji?: string } | undefined)?.emoji ?? '');
    return { content: promptText('core/tools-self.react-done', { emoji, messageId: MESSAGE_ID }) };
  },
};

/** The bot's other tools, as stubs, so it answers as a bot that can do its job rather than one apologising for what it lacks. */
const STUBS: EvalTool[] = [
  ['search_mail', "Searches the person's Gmail inboxes."],
  ['file_to_drive', "Files an attachment in the person's Google Drive."],
  ['check_back', 'Brings you back to this chat at a later time.'],
].map(([name, description]) => ({
  name,
  description,
  inputSchema: { type: 'object', additionalProperties: true, properties: {} },
  run: async () => ({ content: 'Done.' }),
}));
const TOOLS = [REACT, ...STUBS];

/** Words in a reply: letters or digits, so a reply of emoji and punctuation alone has none. */
function hasWords(answer: string): boolean {
  return /[\p{L}\p{N}]/u.test(answer);
}

async function runOnce(via: Transport, data: Cases, item: Case) {
  const system = composeBotSystemPrompt({
    name: data.bot.name,
    description: 'Keeps the person on top of their invoices.',
    soul: botSoulFor(data.bot.name),
    instructions: 'Check both Gmail inboxes for new invoices every morning and file them in Drive.',
    facts: [],
    personFacts: [],
    engineCapabilities: [],
    tools: TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      group: tool === REACT ? 'self' : 'mail',
    })),
  });
  const context = composeTurnContext({
    now: new Date('2026-11-25T09:30:00Z'),
    timeZone: 'Europe/Madrid',
    homeHost: null,
    hosts: [],
    lastContext: null,
  });
  const message = `Your last message in this chat:\n<message>\n${item.history}\n</message>\n\nThe person's answer:\n${item.message}`;
  const turn = await via.turn({
    system,
    message: withTurnContext(context, message),
    tools: TOOLS,
    maxTurns: 4,
  });
  const reacted = turn.calls.some((call) => call.tool === 'react');
  const right = hasWords(turn.answer);
  return { right, reacted, calls: turn.calls, answer: turn.answer, stopped: turn.stopped };
}

async function main(): Promise<void> {
  const data = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8')) as Cases;
  const only = arg('case');
  const runs = Number(arg('runs') ?? 3);
  const cases = data.cases.filter((item) => !only || item.id === only);
  if (cases.length === 0) throw new Error(`No case named ${only}`);
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
  const via = transport(process.env.BOT_REACT_EVAL_MODEL ?? 'claude-sonnet-5-5');
  const jobs = cases.flatMap((item) => Array.from({ length: runs }, () => item));
  const results = await pool(jobs, 4, (item) =>
    runOnce(via, data, item).then((run) => ({ id: item.id, ...run })),
  );
  let failed = 0;
  for (const item of cases) {
    const mine = results.filter((run) => run.id === item.id);
    const right = mine.filter((run) => run.right).length;
    const reacted = mine.filter((run) => run.reacted).length;
    const pass = right * 2 > mine.length;
    if (!pass) failed += 1;
    console.log(
      `${pass ? 'pass' : 'FAIL'}  ${item.id.padEnd(10)} ${right}/${mine.length} with words, ${reacted} reacted`,
    );
    for (const run of mine)
      console.log(`      ${run.reacted ? '[react] ' : ''}${JSON.stringify(run.answer)}`);
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
