#!/usr/bin/env -S pnpm exec tsx
// Does a bot bring back a stopped session itself, instead of asking the person to open it?
//
// On 2026-11-24 a bot told its owner the session it delegated to "is stopped
// and accepts no instructions: open it with the button above". Since then a bot
// restarts a stopped session with `restart_session` (`product/versions/mvp/25-bots.md`),
// and `send_to_session` on one is refused with the way back.
//
// Each case in `cases.json` is one session, stopped (idle, or by a host
// reboot), at its prompt, or stopped with a close the person asked for, and a
// person's message asking the bot to have it do more. The runner builds the
// bot's real system prompt, offers the production session tools over an
// in-memory workspace (`../bot-workspace.ts`) at the case's permission, and
// stands in for the writes: a restart folds `session.restarted` into the
// session, as the host's answer would, and a prompt is taken. It scores the calls.
//
//   pnpm eval:bot-session-restart                        every case, 3 runs each
//   pnpm eval:bot-session-restart --case screenshot-es   one case
//   pnpm eval:bot-session-restart --runs 5
//   env: BOT_SESSION_RESTART_EVAL_MODEL (default claude-sonnet-5-5)
//        ANTHROPIC_API_KEY: with it, the Messages API; without it, the
//        machine's Claude Code login, through the Agent SDK
//
// It passes when every case is right on a majority of its runs. Every run's
// calls and answer go to `reports/`.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { composeBotSystemPrompt } from '../../../apps/api/src/bots-chat/domain/bot-prompt.policy';
import {
  composeTurnContext,
  withTurnContext,
} from '../../../apps/api/src/bots-chat/domain/bot-turn-context.policy';
import { RestartSessionCommand } from '../../../apps/api/src/sessions/commands/restart-session/restart-session.command';
import { SendSessionPromptCommand } from '../../../apps/api/src/sessions/commands/send-session-prompt/send-session-prompt.command';
import type { WorkSessionEntity } from '../../../apps/api/src/sessions/domain/work-session.entity';
import { arg, pool, type Turn, type TurnCall, transport, writeReport } from '../bot-turn';
import { type HostSpec, type LogSpec, type ProjectSpec, workspace } from '../bot-workspace';

/** What a right run does: restart the session, prompt it as it is, or tell the person. */
type Expect = 'restart' | 'send' | 'tell';

interface Bot {
  name: string;
  description: string;
  instructions: string;
}

interface Case {
  id: string;
  bot: string;
  permission: 'ask' | 'auto' | 'full';
  project: string;
  name: string;
  task: string;
  result: string | null;
  /** How the session stands: stopped idle, stopped by a reboot, at its prompt, or stopped and being closed. */
  ending: 'idle' | 'reboot' | 'running' | 'closing';
  ask: string;
  expect: Expect;
  why: string;
}

interface Score {
  right: boolean;
  /** R restarted, S sent, O told the person to open it, T told the person, r restarted a running one, x restarted against a close, u gave up after a bare-name call, - nothing. */
  mark: string;
  note: string;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const MAX_PARALLEL = 6;
const MAX_TURNS = 10;
const MAX_ATTEMPTS = 6;
/** The tools that only read: a run that called only these, then gave up, never acted. */
const READS = ['list_sessions', 'get_session', 'read_session'];
const SESSION_ID = '5e55e000-0000-4000-8000-0000000000bb';
const OFFERED = [
  'list_sessions',
  'get_session',
  'read_session',
  'send_to_session',
  'restart_session',
  'stop_session',
  'close_session',
];
/** "Open it", in the words a bot sends the person to a session with. */
const OPEN_IT = /\b(open|reopen)\b|\babr(e|ir|irla|ela|ela)\b|ábrela|abrirla/i;

/** The session's log: its task and how it ended up. */
function logOf(c: Case): LogSpec[] {
  const log: LogSpec[] = [
    { at: '2026-11-24T14:00:00Z', prompt: c.task },
    { at: '2026-11-24T14:00:20Z', started: true },
    { at: '2026-11-24T14:01:00Z', observed: 'working' },
  ];
  if (c.result) {
    log.push({ at: '2026-11-24T14:40:00Z', result: c.result });
    log.push({ at: '2026-11-24T14:40:05Z', observed: 'idle' });
  }
  if (c.ending === 'running') return log;
  // The runner's idle stop after two hours unwatched, or every session stopping with its host.
  log.push({
    at: c.ending === 'reboot' ? '2026-11-24T15:10:00Z' : '2026-11-24T16:40:05Z',
    kind: 'session.stopped',
    payload: {},
  });
  if (c.ending === 'closing') {
    log.push({
      at: '2026-11-24T19:00:00Z',
      kind: 'session.close_requested',
      payload: { acceptUnpushedWork: false },
    });
  }
  return log;
}

/** The writes, as the API and the host would answer them; anything else is not this eval's. */
function onCommand(command: unknown, sessions: readonly WorkSessionEntity[]): unknown {
  const session = sessions.find((candidate) => candidate.id === SESSION_ID) as WorkSessionEntity;
  if (command instanceof RestartSessionCommand) {
    // The host brings window 0 back at once.
    session.recordEvent({
      seq: 100,
      kind: 'session.restarted',
      payload: {},
      occurredAt: new Date('2026-11-24T20:11:30Z'),
    });
    return { sessionId: session.id, hints: [] };
  }
  if (command instanceof SendSessionPromptCommand) {
    return { sessionId: session.id, hints: [], seq: 101 };
  }
  throw new Error(`The eval runs no ${(command as object)?.constructor?.name}.`);
}

const taken = (turn: Turn, tool: string): TurnCall[] =>
  turn.calls.filter((call) => call.tool === tool && !call.isError);

function scoreRun(turn: Turn, expect: Expect): Score {
  // A run that gave up after a call by the bare name (which Claude Code never
  // runs) says nothing about restarting: it is counted apart.
  // Any write that reached its tool, taken or refused, is the bot's own choice.
  const acted = turn.calls.some((call) => !READS.includes(call.tool));
  if ((turn.unprefixed?.length ?? 0) > 0 && !acted) {
    return {
      right: false,
      mark: 'u',
      note: `gave up after a bare-name call (${turn.unprefixed?.join(',')})`,
    };
  }
  const restarts = taken(turn, 'restart_session');
  const sends = taken(turn, 'send_to_session');
  const said = turn.answer.replace(/\s+/g, ' ').trim();
  const tried = turn.calls.map((call) => `${call.tool}${call.isError ? '!' : ''}`).join(',');
  if (expect === 'restart') {
    if (restarts.length > 0) {
      return { right: true, mark: 'R', note: `${tried}${sends.length > 0 ? ' (then sent)' : ''}` };
    }
    return OPEN_IT.test(said)
      ? { right: false, mark: 'O', note: `told to open it; calls ${tried}` }
      : { right: false, mark: said ? 'T' : '-', note: `no restart; calls ${tried}` };
  }
  if (expect === 'send') {
    if (restarts.length > 0) return { right: false, mark: 'r', note: `restarted; calls ${tried}` };
    return sends.length > 0
      ? { right: true, mark: 'S', note: tried }
      : { right: false, mark: 'T', note: `did not send; calls ${tried}` };
  }
  if (restarts.length > 0) return { right: false, mark: 'x', note: `restarted; calls ${tried}` };
  return said
    ? { right: true, mark: 'T', note: tried }
    : { right: false, mark: '-', note: 'said nothing' };
}

async function main(): Promise<void> {
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
  const via = transport(process.env.BOT_SESSION_RESTART_EVAL_MODEL ?? 'claude-sonnet-5-5');
  const runs = Number(arg('runs') ?? 3);
  const only = arg('case');
  const file = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8')) as {
    now: string;
    bots: Record<string, Bot>;
    hosts: HostSpec[];
    projects: ProjectSpec[];
    cases: Case[];
  };
  const chosen = file.cases.filter((c) => !only || c.id === only);
  if (chosen.length === 0) throw new Error(`No case "${only}".`);

  const host = file.hosts[0] as HostSpec;
  const spaceOf = (c: Case) =>
    workspace({
      home: host.name,
      hosts: file.hosts,
      projects: file.projects,
      permission: c.permission,
      onCommand,
      sessions: [
        { id: SESSION_ID, name: c.name, host: host.name, project: c.project, log: logOf(c) },
      ],
    });
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
  const systemOf = (c: Case) => {
    const bot = file.bots[c.bot];
    if (!bot) throw new Error(`Case ${c.id} names no bot "${c.bot}".`);
    const listed = spaceOf(c).definitions.filter(({ definition }) =>
      OFFERED.includes(definition.name),
    );
    return composeBotSystemPrompt({
      name: bot.name,
      description: bot.description,
      soul: '',
      instructions: bot.instructions,
      facts: [],
      engineCapabilities: [],
      tools: listed.map(({ group, definition }) => ({
        name: definition.name,
        description: definition.description,
        group: group as never,
      })),
    });
  };

  const jobs = chosen.flatMap((c) => Array.from({ length: runs }, () => c));
  let lostToBareNames = 0;
  const turns = await pool(jobs, MAX_PARALLEL, async (c) => {
    // A run lost to a bare-name call (the eval's transport, not the bot's
    // choice) is run again, so each case is judged on runs that could act.
    for (let attempt = 1; ; attempt++) {
      const turn = await via.turn({
        system: systemOf(c),
        message: withTurnContext(context, c.ask),
        // A fresh workspace each run: nothing one run did is seen by another.
        tools: spaceOf(c).tools(OFFERED),
        maxTurns: MAX_TURNS,
        maxTokens: 4096,
      });
      if (scoreRun(turn, c.expect).mark !== 'u' || attempt === MAX_ATTEMPTS) return turn;
      lostToBareNames++;
    }
  });
  const results = chosen.map((c, i) => {
    const caseTurns = turns.slice(i * runs, (i + 1) * runs);
    const scores = caseTurns.map((turn) => scoreRun(turn, c.expect));
    const right = scores.filter((score) => score.right).length;
    return { ...c, turns: caseTurns, scores, right, passed: right * 2 > runs };
  });

  const width = Math.max(...results.map((r) => r.id.length));
  for (const r of results) {
    console.log(
      `${r.passed ? 'pass' : 'FAIL'}  ${r.id.padEnd(width)}  want ${r.expect.padEnd(7)}  got ${r.scores.map((s) => s.mark).join('')}  ${r.right}/${runs}`,
    );
    r.scores.forEach((score, at) => {
      const turn = r.turns[at] as Turn;
      console.log(`        ${score.note}${turn.stopped ? ` [${turn.stopped}]` : ''}`);
      if (!score.right) {
        console.log(`        said: ${turn.answer.replace(/\s+/g, ' ').slice(0, 240)}`);
      }
    });
  }
  const total = results.length * runs;
  const right = results.reduce((sum, r) => sum + r.right, 0);
  const harness = results.reduce(
    (sum, r) => sum + r.scores.filter((s) => s.mark === 'u').length,
    0,
  );
  const toldToOpen = results.reduce(
    (sum, r) => sum + r.scores.filter((s) => s.mark === 'O').length,
    0,
  );
  const failed = results.filter((r) => !r.passed).length;
  console.log(
    `\n${via.model} (${via.engine}): ${right}/${total} runs right; ${toldToOpen} told the person to open a session it could have restarted; ${harness} still lost to a bare-name call after ${MAX_ATTEMPTS} tries (${lostToBareNames} runs re-run for it); ${failed} of ${results.length} cases failed.`,
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
