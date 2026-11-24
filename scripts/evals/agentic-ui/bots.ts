#!/usr/bin/env -S pnpm exec tsx
// Does a bot use the chat's agentic UI the way its tools teach it?
//
// Since 2026-11-24 a bot can draw a visual (`show_visual`), ask for several
// values on a form (`ask_form`) and ask a choice on a card (`ask_user`). Each
// is only worth it at the right moment: a visual when it reads faster than
// words, never for one number, never with made-up data, a Markdown table when
// the person asks for a table; a form for several typed values, a question
// card for one choice. `cases.json` holds a bot, a fleet of hosts and the
// cases, each with what a right run does.
//
// The runner builds the bot's real system prompt and serves the production
// `show_visual`, `ask_form` and `ask_user` (their descriptions, checks and
// refusals; the cards' stores are stand-ins) with the production session
// tools over the in-memory workspace (`../bot-workspace.ts`). Besides right
// or wrong, each run reports whether its first visual parsed (a refusal the
// model had to fix costs a turn) and whether the answer repeated the
// visual's numbers, which the tool asks it not to.
//
//   pnpm eval:agentic-ui:bots                        every case, 3 runs each
//   pnpm eval:agentic-ui:bots --case one-number      one case
//   pnpm eval:agentic-ui:bots --runs 5
//   env: AGENTIC_UI_EVAL_MODEL (default claude-sonnet-5-5)
//        ANTHROPIC_API_KEY: with it, the Messages API; without it, the
//        machine's Claude Code login, through the Agent SDK
//
// It passes when every case is right on a majority of its runs. Every run's
// calls and answer go to `reports/`.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BotFormToolsFactory } from '../../../apps/api/src/bots-chat/application/bot-form-tools.factory';
import { BotQuestionToolsFactory } from '../../../apps/api/src/bots-chat/application/bot-question-tools.factory';
import type {
  BotToolContext,
  BotToolDefinition,
} from '../../../apps/api/src/bots-chat/application/bot-tool.factory';
import { BotVisualToolsFactory } from '../../../apps/api/src/bots-chat/application/bot-visual-tools.factory';
import { composeBotSystemPrompt } from '../../../apps/api/src/bots-chat/domain/bot-prompt.policy';
import { BotTurnBudget } from '../../../apps/api/src/bots-chat/domain/bot-turn-budget.policy';
import {
  composeTurnContext,
  withTurnContext,
} from '../../../apps/api/src/bots-chat/domain/bot-turn-context.policy';
import { arg, type EvalTool, pool, type Turn, transport, writeReport } from '../bot-turn';
import { type HostSpec, type ProjectSpec, workspace } from '../bot-workspace';
import { echoedNumbers, NUMERIC_BLOCKS } from './score';

/** What a right run does. */
type Expect =
  /** Shows a visual, with at least one block of the case's `blocks`. */
  | 'visual'
  /** Shows none, and asks nothing: words answer it. */
  | 'no_visual'
  /** Draws no figure it could not have read: a visual with numbers is wrong. */
  | 'no_invented'
  /** Asks for the values on a form. */
  | 'form'
  /** Asks the one choice on a question card. */
  | 'question';

interface Case {
  id: string;
  message: string;
  expect: Expect;
  blocks?: string[];
  why: string;
}

interface Score {
  right: boolean;
  /** One letter, as the README's table says. */
  mark: string;
  /** Whether the first visual the run sent parsed; null when it sent none. */
  firstTry: boolean | null;
  /** The visual's numbers the answer said again. */
  echoed: number;
  note: string;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const MAX_PARALLEL = 6;
const MAX_TURNS = 8;
const PRODUCTION = [
  'list_hosts',
  'list_sessions',
  'get_session',
  'start_session',
  'send_to_session',
];

/** A production tool bound to the turn, run as production runs it. */
function served(definition: BotToolDefinition, context: BotToolContext): EvalTool {
  const bound = definition.bind(context);
  return {
    name: bound.name,
    description: bound.description,
    inputSchema: bound.inputSchema,
    run: async (input) => {
      const result = await bound.run(input, { signal: new AbortController().signal });
      return { content: result.content, isError: result.isError };
    },
  };
}

/** `show_visual`, `ask_form` and `ask_user` from production, over stand-in stores. */
function cardTools(context: BotToolContext): EvalTool[] {
  const stream = { publish: async () => undefined };
  const store = { insertPending: async () => 'inserted' as const };
  const flags = { isEnabled: () => true };
  return [
    ...new BotVisualToolsFactory(flags as never).definitions(),
    ...new BotFormToolsFactory(store as never, stream as never).definitions(),
    ...new BotQuestionToolsFactory(store as never, stream as never).definitions(),
  ].map((definition) => served(definition, context));
}

function scoreRun(turn: Turn, c: Case): Score {
  const visuals = turn.calls.filter((call) => call.tool === 'show_visual');
  const shown = visuals.filter((call) => !call.isError);
  const firstTry = visuals.length === 0 ? null : !visuals[0]?.isError;
  const types = shown.flatMap((call) =>
    ((call.input as { blocks?: { type?: string }[] }).blocks ?? []).map((b) => String(b.type)),
  );
  // A card that was not put up answers as plain text ("Not asked: …"), not as an error.
  const put = (tool: string) =>
    turn.calls.some(
      (call) => call.tool === tool && !call.isError && !call.content.startsWith('Not asked'),
    );
  const asked = put('ask_form');
  const questioned = put('ask_user');
  const echoed = echoedNumbers(
    shown.map((call) => call.input),
    turn.answer,
  );
  const note = `${shown.length ? `visual [${types.join(', ')}]` : visuals.length ? `${visuals.length} refused visual(s)` : 'no visual'}${asked ? '; ask_form' : ''}${questioned ? '; ask_user' : ''}${firstTry === false ? `; first refused: ${visuals[0]?.content.replace(/\s+/g, ' ').slice(0, 160)}` : ''}; said: ${turn.answer.replace(/\s+/g, ' ').slice(0, 160) || '(nothing)'}`;
  const base = { firstTry, echoed, note };
  // A run that failed or hit its cap did not answer: it is never right, whatever it left undone.
  if (turn.stopped)
    return { ...base, right: false, mark: '!', note: `${note} [stopped: ${turn.stopped}]` };
  switch (c.expect) {
    case 'visual': {
      if (shown.length === 0) return { ...base, right: false, mark: visuals.length ? 'e' : '-' };
      const fits = !c.blocks || types.some((type) => c.blocks?.includes(type));
      return { ...base, right: fits, mark: fits ? 'V' : 'v' };
    }
    case 'no_visual':
      if (shown.length > 0) return { ...base, right: false, mark: 'x' };
      if (asked || questioned) return { ...base, right: false, mark: 'a' };
      return { ...base, right: true, mark: '.' };
    case 'no_invented': {
      const drew = types.some((type) => NUMERIC_BLOCKS.has(type));
      return { ...base, right: !drew, mark: drew ? 'i' : '.' };
    }
    case 'form':
      return { ...base, right: asked && !questioned, mark: asked ? 'F' : questioned ? 'q' : '-' };
    case 'question':
      return { ...base, right: questioned && !asked, mark: questioned ? 'Q' : asked ? 'f' : '-' };
  }
}

async function main(): Promise<void> {
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
  const via = transport(process.env.AGENTIC_UI_EVAL_MODEL ?? 'claude-sonnet-5-5');
  const runs = Number(arg('runs') ?? 3);
  const only = arg('case');
  const file = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8')) as {
    now: string;
    bot: { name: string; description: string; instructions: string };
    hosts: HostSpec[];
    projects: ProjectSpec[];
    cases: Case[];
  };
  const chosen = file.cases.filter((c) => !only || c.id === only);
  if (chosen.length === 0) throw new Error(`No case "${only}".`);
  const home = file.hosts[0] as HostSpec;
  const space = () => workspace({ home: home.name, hosts: file.hosts, projects: file.projects });

  const toolsOf = () => {
    const ws = space();
    // A fresh budget each run, on a turn the person is waiting on.
    const context: BotToolContext = {
      ...ws.context,
      budget: new BotTurnBudget(),
      origin: 'message',
      lane: 'owner',
    };
    return { ws, tools: [...ws.tools(PRODUCTION), ...cardTools(context)] };
  };
  const systemOf = () => {
    const { ws, tools } = toolsOf();
    const groupOf = new Map(ws.definitions.map((d) => [d.definition.name, d.group]));
    return composeBotSystemPrompt({
      name: file.bot.name,
      description: file.bot.description,
      soul: '',
      instructions: file.bot.instructions,
      facts: [],
      engineCapabilities: [],
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        group: (groupOf.get(tool.name) ?? 'self') as never,
      })),
    });
  };
  const turnContext = composeTurnContext({
    now: new Date(file.now),
    timeZone: 'Europe/Madrid',
    homeHost: { name: home.name, online: home.online, runningSessions: home.runningSessions ?? 0 },
    hosts: file.hosts.map((h) => ({
      name: h.name,
      online: h.online,
      runningSessions: h.runningSessions ?? 0,
    })),
    lastContext: null,
  });

  const jobs = chosen.flatMap((c) => Array.from({ length: runs }, () => c));
  const turns = await pool(jobs, MAX_PARALLEL, (c) =>
    via.turn({
      system: systemOf(),
      message: withTurnContext(turnContext, c.message),
      tools: toolsOf().tools,
      maxTurns: MAX_TURNS,
      maxTokens: 8192,
    }),
  );
  const results = chosen.map((c, i) => {
    const caseTurns = turns.slice(i * runs, (i + 1) * runs);
    const scores = caseTurns.map((turn) => scoreRun(turn, c));
    const right = scores.filter((score) => score.right).length;
    return { ...c, turns: caseTurns, scores, right, passed: right * 2 > runs };
  });

  const width = Math.max(...results.map((r) => r.id.length));
  for (const r of results) {
    console.log(
      `${r.passed ? 'pass' : 'FAIL'}  ${r.id.padEnd(width)}  want ${r.expect.padEnd(11)}  got ${r.scores.map((s) => s.mark).join('')}  ${r.right}/${runs}`,
    );
    r.scores.forEach((score, at) => {
      const turn = r.turns[at] as Turn;
      if (!score.right || score.firstTry === false || score.echoed >= 3) {
        console.log(
          `        ${score.right ? 'ok ' : 'BAD'} ${score.note}${score.echoed >= 3 ? ` [echoed ${score.echoed} numbers]` : ''}${turn.stopped ? ` [${turn.stopped}]` : ''}`,
        );
      }
    });
  }
  const all = results.flatMap((r) => r.scores);
  const sent = all.filter((s) => s.firstTry !== null);
  const firstTry = sent.filter((s) => s.firstTry).length;
  const echoing = all.filter((s) => s.echoed >= 3).length;
  const right = all.filter((s) => s.right).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(
    `\n${via.model} (${via.engine}): ${right}/${all.length} runs right; first visual parsed in ${firstTry}/${sent.length}; ${echoing} answer(s) repeated 3+ of the visual's numbers; ${failed} of ${results.length} cases failed.`,
  );
  console.log(
    `Report: ${writeReport(HERE, { lane: 'bots', model: via.model, engine: via.engine, runs, results })}`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(2);
});
