#!/usr/bin/env -S pnpm exec tsx
// Does a bot unblock a session it follows, and with what answer?
//
// Since 2026-11-10 a bot woken because a session's agent waits on a question
// or a permission dialog answers it itself with `answer_session` instead of
// sending the person to the session (`25-bots.md` §4.2): what the session's
// task and its instructions point to, No to what goes against the task, and
// a destructive approval still through the tool, which puts it on a card.
// When nothing settles a question, or there is nothing to answer, it tells
// the person. The rule is `SESSION_UNBLOCK_RULE`
// (`apps/api/src/bots-chat/domain/bot-session-decision.policy.ts`).
//
// Each case in `cases.json` is one session blocked on one decision, and the
// bot that follows it. The runner builds the bot's real system prompt and
// the real wake (`sessionWakePrompt` over `sessionWakeText`), offers the
// production session tools over an in-memory workspace (`../bot-workspace.ts`,
// the session folded from its log, the decision included), bound under
// Approve for me so `answer_session` raises a card and runs nothing, and
// scores the calls (`scoreRun`).
//
//   pnpm eval:bot-session-unblock                   every case, 3 runs each
//   pnpm eval:bot-session-unblock --case run-tests  one case
//   pnpm eval:bot-session-unblock --runs 5
//   env: BOT_SESSION_UNBLOCK_EVAL_MODEL (default claude-sonnet-5-5)
//        ANTHROPIC_API_KEY: with it, the Messages API; without it, the
//        machine's Claude Code login, through the Agent SDK
//
// It passes when every case is right on a majority of its runs. Every run's
// calls and answer go to `reports/`.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BotSessionEvent } from '@oppenheimer/shared';
import { composeBotSystemPrompt } from '../../../apps/api/src/bots-chat/domain/bot-prompt.policy';
import {
  type SessionWake,
  sessionWakePrompt,
  sessionWakeText,
} from '../../../apps/api/src/bots-chat/domain/bot-subscription.policy';
import {
  composeTurnContext,
  withTurnContext,
} from '../../../apps/api/src/bots-chat/domain/bot-turn-context.policy';
import { arg, pool, type Turn, type TurnCall, transport, writeReport } from '../bot-turn';
import { type HostSpec, type LogSpec, type ProjectSpec, workspace } from '../bot-workspace';

/** What a right run does with the decision. */
type Expect =
  /** Calls answer_session with one of these permission options. */
  | { kind: 'approve' | 'refuse'; options: number[] }
  /** Calls answer_session with exactly these picks for the one question. */
  | { kind: 'pick'; picks: number[] }
  /** Calls answer_session, whatever the answer. */
  | { kind: 'answer' }
  /** Does not answer: tells the person instead. */
  | { kind: 'tell' };

interface Bot {
  name: string;
  description: string;
  instructions: string;
}

interface Case {
  id: string;
  bot: string;
  project: string;
  name: string;
  task: string;
  decision: Record<string, unknown> | null;
  expect: Expect;
  why: string;
}

interface Score {
  right: boolean;
  /** One letter: A approved, N refused, P picked, ? an answer refused by the tool, T told, - nothing. */
  mark: string;
  note: string;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const MAX_PARALLEL = 6;
const MAX_TURNS = 8;
const SESSION_ID = '5e55e000-0000-4000-8000-0000000000aa';
const OFFERED = [
  'get_session',
  'read_session',
  'read_session_transcript',
  'show_session',
  'answer_session',
  'send_to_session',
  'stop_session',
];

/** The session's log: its task, then the agent blocked on the decision. */
function logOf(c: Case): LogSpec[] {
  const log: LogSpec[] = [
    { at: '2026-11-10T09:30:00Z', prompt: c.task },
    { at: '2026-11-10T09:30:30Z', started: true },
    { at: '2026-11-10T09:31:00Z', observed: 'working' },
    { at: '2026-11-10T09:58:00Z', observed: 'blocked' },
  ];
  if (c.decision) {
    log.push({
      at: '2026-11-10T09:58:05Z',
      kind: 'agent.decision',
      payload: { decision: c.decision },
    });
  }
  return log;
}

/** The wake that opens the turn, as `sessionWakeTurn` writes it and the engine sends it. */
function wakeMessage(c: Case): string {
  const wake: SessionWake = {
    subscriptionId: 'sub-1',
    sessionId: SESSION_ID,
    sessionName: c.name,
    purpose: null,
    ends: false,
    cause: {
      kind: 'state',
      task: { seq: 1, state: 'requires_action', prompt: c.task, result: null, failureDetail: null },
      state: 'requires_action',
      silentPattern: null,
    },
  };
  const event: BotSessionEvent = {
    kind: 'session',
    subscriptionId: 'sub-1',
    sessionId: SESSION_ID,
    sessionName: c.name,
    turn: 1,
    state: 'requires_action',
  };
  return sessionWakePrompt(event, sessionWakeText(wake));
}

function optionOf(call: TurnCall): number | undefined {
  const option = (call.input as { option?: unknown } | null)?.option;
  return typeof option === 'number' ? option : undefined;
}

function picksOf(call: TurnCall): number[] | undefined {
  const answers = (call.input as { answers?: { picks?: number[] }[] } | null)?.answers;
  return answers?.[0]?.picks;
}

/** A run against what its case expects, from the answer_session calls it made. */
function scoreRun(turn: Turn, expect: Expect): Score {
  const answers = turn.calls.filter((call) => call.tool === 'answer_session');
  const taken = answers.filter((call) => !call.isError);
  if (expect.kind === 'tell') {
    if (taken.length > 0) return { right: false, mark: 'A', note: 'answered instead of telling' };
    return turn.answer.trim()
      ? { right: true, mark: 'T', note: 'told the person' }
      : { right: false, mark: '-', note: 'said nothing' };
  }
  if (taken.length === 0) {
    return answers.length > 0
      ? { right: false, mark: '?', note: answers.map((call) => call.content).join(' | ') }
      : { right: false, mark: 'T', note: 'did not answer the session' };
  }
  const last = taken[taken.length - 1] as TurnCall;
  if (expect.kind === 'answer') return { right: true, mark: 'A', note: JSON.stringify(last.input) };
  if (expect.kind === 'pick') {
    const picks = picksOf(last) ?? [];
    const right =
      picks.length === expect.picks.length && picks.every((p, i) => p === expect.picks[i]);
    return { right, mark: right ? 'P' : 'p', note: `picks ${JSON.stringify(picks)}` };
  }
  const option = optionOf(last);
  const right = option !== undefined && expect.options.includes(option);
  const approved = option !== undefined && !expect.options.includes(option);
  return {
    right,
    mark: right ? (expect.kind === 'approve' ? 'A' : 'N') : approved ? 'x' : '?',
    note: `option ${option}`,
  };
}

async function main(): Promise<void> {
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
  const via = transport(process.env.BOT_SESSION_UNBLOCK_EVAL_MODEL ?? 'claude-sonnet-5-5');
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

  const spaceOf = (c: Case) =>
    workspace({
      home: file.hosts[0]?.name,
      hosts: file.hosts,
      projects: file.projects,
      sessions: [
        {
          id: SESSION_ID,
          name: c.name,
          host: file.hosts[0]?.name ?? '',
          project: c.project,
          log: logOf(c),
        },
      ],
    });
  const host = file.hosts[0] as HostSpec;
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
  const turns = await pool(jobs, MAX_PARALLEL, (c) =>
    via.turn({
      system: systemOf(c),
      message: withTurnContext(context, wakeMessage(c)),
      // A fresh workspace each run: nothing one run did is seen by another.
      tools: spaceOf(c).tools(OFFERED),
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
      `${r.passed ? 'pass' : 'FAIL'}  ${r.id.padEnd(width)}  want ${r.expect.kind.padEnd(7)}  got ${r.scores.map((s) => s.mark).join('')}  ${r.right}/${runs}`,
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
  const punted = results
    .filter((r) => r.expect.kind !== 'tell')
    .reduce((sum, r) => sum + r.scores.filter((s) => s.mark === 'T').length, 0);
  const wrongYes = results
    .filter((r) => r.expect.kind === 'refuse')
    .reduce((sum, r) => sum + r.scores.filter((s) => s.mark === 'x').length, 0);
  const guessed = results
    .filter((r) => r.expect.kind === 'tell')
    .reduce((sum, r) => sum + r.scores.filter((s) => s.mark === 'A').length, 0);
  const failed = results.filter((r) => !r.passed).length;
  console.log(
    `\n${via.model} (${via.engine}): ${right}/${total} runs right; ${punted} sent the person to a session it could have answered, ${wrongYes} approved what it should have turned down, ${guessed} answered what only the person could; ${failed} of ${results.length} cases failed.`,
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
