#!/usr/bin/env -S pnpm exec tsx
// Does a bot follow a session it says it will come back to?
//
// On 2026-11-10 Facturas told the owner it would check a session "when it
// pushes" and send the table after, and nothing woke it: it had only read
// that session, which it had not started. Since then the prompt tells a bot
// to say it will come back to a session only when something will wake it,
// and to `watch_session` any other before its turn ends, with
// `check_in_minutes` for a time it names (`27-bot-subscriptions.md` §4.2).
//
// Each case in `cases.json` is one message from the person about a session
// the bot did not start, running or already done. The runner builds the
// bot's real system prompt and serves the production session tools over an
// in-memory workspace (`../bot-workspace.ts`). `watch_session` is the
// production definition with a stand-in run that answers as a stored watch
// would and records the call. A run is scored on its `watch_session` calls
// (`scoreRun`).
//
//   pnpm eval:bot-session-follow                         every case, 3 runs each
//   pnpm eval:bot-session-follow --case look-again-20    one case
//   pnpm eval:bot-session-follow --runs 5
//   env: BOT_SESSION_FOLLOW_EVAL_MODEL (default claude-sonnet-5-5)
//        ANTHROPIC_API_KEY: with it, the Messages API; without it, the
//        machine's Claude Code login, through the Agent SDK
//
// It passes when every case is right on a majority of its runs. Every run's
// calls and answer go to `reports/`.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BotWatchToolsFactory } from '../../../apps/api/src/bots-chat/application/bot-watch-tools.factory';
import { BotSubscriptionMapper } from '../../../apps/api/src/bots-chat/bot-subscription.mapper';
import { composeBotSystemPrompt } from '../../../apps/api/src/bots-chat/domain/bot-prompt.policy';
import {
  composeTurnContext,
  withTurnContext,
} from '../../../apps/api/src/bots-chat/domain/bot-turn-context.policy';
import { arg, type EvalTool, pool, type Turn, transport, writeReport } from '../bot-turn';
import { type HostSpec, type LogSpec, type ProjectSpec, workspace } from '../bot-workspace';

/** What a right run does about the session. */
type Expect =
  /** Calls watch_session on it. */
  | { kind: 'watch' }
  /** Calls watch_session on it with check_in_minutes in this range. */
  | { kind: 'check_in'; minutes: [number, number] }
  /** Does not watch it: nothing is left to come back to. */
  | { kind: 'no_watch' };

interface Bot {
  name: string;
  description: string;
  instructions: string;
}

interface SessionCase {
  name: string;
  task: string;
  /** The log; an entry with `prompt: true` is the task. */
  log: (Omit<LogSpec, 'prompt'> & { prompt?: true })[];
}

interface Case {
  id: string;
  session: string;
  message: string;
  expect: Expect;
  why: string;
}

interface Score {
  right: boolean;
  /** One letter: W watched, C watched with a check-in in range, c out of range, w watched what it should not, - did not watch. */
  mark: string;
  note: string;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const MAX_PARALLEL = 6;
const MAX_TURNS = 8;
const SESSION_ID = '5e55e000-0000-4000-8000-0000000000bb';
const PRODUCTION = [
  'list_sessions',
  'get_session',
  'read_session',
  'read_session_transcript',
  'start_session',
  'send_to_session',
  'answer_session',
];
const WATCH = 'watch_session';

/**
 * `watch_session` as the model sees it in production, run by a stand-in: a
 * stored watch's answer, and the call kept for the score. The real one needs
 * the subscriptions table.
 */
function watchTool(
  context: Parameters<ReturnType<BotWatchToolsFactory['definitions']>[number]['bind']>[0],
): EvalTool {
  const factory = new BotWatchToolsFactory(
    {} as never,
    {} as never,
    new BotSubscriptionMapper(),
    {} as never,
  );
  const definition = factory.definitions().find((d) => d.name === WATCH);
  if (!definition) throw new Error('No production watch_session.');
  const bound = definition.bind(context);
  return {
    name: bound.name,
    description: bound.description,
    inputSchema: bound.inputSchema,
    run: async (input) => {
      const minutes = (input as { check_in_minutes?: number } | null)?.check_in_minutes;
      const asked = minutes ? ` and once in ${minutes} minutes, as you asked` : '';
      return {
        content: `You follow session ${SESSION_ID}: its running task, until it ends. You will be woken when it needs input, finishes, fails or is stopped; while it runs you are also woken every few minutes${asked} to look at how it is going. End your turn now rather than wait for it.`,
      };
    },
  };
}

/** A run against what its case expects, from the watch_session calls it made. */
function scoreRun(turn: Turn, expect: Expect): Score {
  const watches = turn.calls.filter((call) => call.tool === WATCH && !call.isError);
  if (expect.kind === 'no_watch') {
    return watches.length === 0
      ? { right: true, mark: '.', note: 'did not watch' }
      : { right: false, mark: 'w', note: JSON.stringify(watches[0]?.input) };
  }
  if (watches.length === 0) return { right: false, mark: '-', note: 'did not watch' };
  if (expect.kind === 'watch')
    return { right: true, mark: 'W', note: JSON.stringify(watches[0]?.input) };
  const minutes = watches
    .map((call) => (call.input as { check_in_minutes?: unknown } | null)?.check_in_minutes)
    .find((value): value is number => typeof value === 'number');
  const [low, high] = expect.minutes;
  const right = minutes !== undefined && minutes >= low && minutes <= high;
  return { right, mark: right ? 'C' : 'c', note: `check_in_minutes ${minutes}` };
}

async function main(): Promise<void> {
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
  const via = transport(process.env.BOT_SESSION_FOLLOW_EVAL_MODEL ?? 'claude-sonnet-5-5');
  const runs = Number(arg('runs') ?? 3);
  const only = arg('case');
  const file = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8')) as {
    now: string;
    bots: Record<string, Bot>;
    hosts: HostSpec[];
    projects: ProjectSpec[];
    sessions: Record<string, SessionCase>;
    cases: Case[];
  };
  const chosen = file.cases.filter((c) => !only || c.id === only);
  if (chosen.length === 0) throw new Error(`No case "${only}".`);
  const bot = Object.values(file.bots)[0] as Bot;
  const host = file.hosts[0] as HostSpec;
  const project = file.projects[0] as ProjectSpec;

  const spaceOf = (c: Case) => {
    const session = file.sessions[c.session];
    if (!session) throw new Error(`Case ${c.id} names no session "${c.session}".`);
    return workspace({
      home: host.name,
      hosts: file.hosts,
      projects: file.projects,
      sessions: [
        {
          id: SESSION_ID,
          name: session.name,
          host: host.name,
          project: project.name,
          log: session.log.map((entry) =>
            entry.prompt ? { ...entry, prompt: session.task } : (entry as LogSpec),
          ),
        },
      ],
    });
  };
  const toolsOf = (c: Case) => {
    const space = spaceOf(c);
    return [...space.tools(PRODUCTION), watchTool(space.context)];
  };
  const context = composeTurnContext({
    now: new Date(file.now),
    timeZone: 'Europe/Madrid',
    homeHost: { name: host.name, online: host.online, runningSessions: host.runningSessions ?? 0 },
    hosts: file.hosts.map((h) => ({
      name: h.name,
      online: h.online,
      runningSessions: h.runningSessions ?? 0,
    })),
    lastContext: null,
  });
  const system = (() => {
    const c = chosen[0] as Case;
    const tools = toolsOf(c);
    const groupOf = new Map(spaceOf(c).definitions.map((d) => [d.definition.name, d.group]));
    return composeBotSystemPrompt({
      name: bot.name,
      description: bot.description,
      soul: '',
      instructions: bot.instructions,
      facts: [],
      engineCapabilities: [],
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        group: (groupOf.get(tool.name) ?? 'sessions') as never,
      })),
    });
  })();

  const jobs = chosen.flatMap((c) => Array.from({ length: runs }, () => c));
  const turns = await pool(jobs, MAX_PARALLEL, (c) =>
    via.turn({
      system,
      message: withTurnContext(context, c.message),
      // A fresh workspace each run: nothing one run did is seen by another.
      tools: toolsOf(c),
      maxTurns: MAX_TURNS,
      maxTokens: 4096,
    }),
  );
  const results = chosen.map((c, i) => {
    const caseTurns = turns.slice(i * runs, (i + 1) * runs);
    const scores = caseTurns.map((turn) => scoreRun(turn, c.expect));
    const right = scores.filter((score) => score.right).length;
    return { ...c, turns: caseTurns, scores, right, passed: right * 2 > runs };
  });

  const width = Math.max(...results.map((r) => r.id.length));
  for (const r of results) {
    console.log(
      `${r.passed ? 'pass' : 'FAIL'}  ${r.id.padEnd(width)}  want ${r.expect.kind.padEnd(8)}  got ${r.scores.map((s) => s.mark).join('')}  ${r.right}/${runs}`,
    );
    if (!r.passed) {
      r.scores.forEach((score, at) => {
        const turn = r.turns[at] as Turn;
        console.log(`        ${score.note}${turn.stopped ? ` [${turn.stopped}]` : ''}`);
        console.log(`        said: ${turn.answer.replace(/\s+/g, ' ').slice(0, 240)}`);
      });
    }
  }
  const total = results.length * runs;
  const right = results.reduce((sum, r) => sum + r.right, 0);
  const unwatched = results
    .filter((r) => r.expect.kind !== 'no_watch')
    .reduce((sum, r) => sum + r.scores.filter((s) => s.mark === '-').length, 0);
  const failed = results.filter((r) => !r.passed).length;
  console.log(
    `\n${via.model} (${via.engine}): ${right}/${total} runs right; ${unwatched} left a session it should come back to unwatched; ${failed} of ${results.length} cases failed.`,
  );
  console.log(
    `Report: ${writeReport(HERE, { model: via.model, engine: via.engine, runs, results })}`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(2);
});
