#!/usr/bin/env -S pnpm exec tsx
// Does a bot solve a blocker a routine's run meets, when a way round makes sense?
//
// On 2026-11-12 the owner saw Oppie answer its half-hourly Sentry check with
// "the designated session is still closed" for hours, when a new session
// with the same task would have run it. Since then a blocker is the bot's to
// solve before it is the bot's to report (`bot-recovery.policy.ts`), and a
// routine's or a loop's run is told so in the note that opens it.
//
// Each case in `cases.json` is one run of the routine: the session it names
// closed or open, the bot's instructions allowing a new one or not, and what
// its earlier runs said. The runner builds the bot's real system prompt and
// the real routine opening (`routineOpening`), and serves the production
// session tools over an in-memory workspace (`../bot-workspace.ts`), bound
// under Approve for me, so `start_session` raises a card and runs nothing.
// A run is scored on its `start_session`, `send_to_session` and `notify`
// calls and on the words the chat keeps of it (`scoreRun`, `keptWords`).
//
//   pnpm eval:bot-blocked-run                          every case, 3 runs each
//   pnpm eval:bot-blocked-run --case closed-first-time one case
//   pnpm eval:bot-blocked-run --runs 5
//   env: BOT_BLOCKED_RUN_EVAL_MODEL (default claude-sonnet-5-5)
//        ANTHROPIC_API_KEY: with it, the Messages API; without it, the
//        machine's Claude Code login, through the Agent SDK
//
// It passes when every case is right on a majority of its runs; a case
// marked `open` is run and reported, and does not fail it. Every run's
// calls and answer go to `reports/`.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BotNoticeToolsFactory } from '../../../apps/api/src/bots-chat/application/bot-notice-tools.factory';
import { composeBotSystemPrompt } from '../../../apps/api/src/bots-chat/domain/bot-prompt.policy';
import {
  QuietTurn,
  quietTurnAnswer,
  routineOpening,
} from '../../../apps/api/src/bots-chat/domain/bot-routine.policy';
import {
  composeTurnContext,
  withTurnContext,
} from '../../../apps/api/src/bots-chat/domain/bot-turn-context.policy';
import {
  arg,
  type EvalTool,
  pool,
  type Turn,
  type TurnCall,
  transport,
  writeReport,
} from '../bot-turn';
import { type HostSpec, type LogSpec, type ProjectSpec, workspace } from '../bot-workspace';

/** What a right run does about the routine's work. */
type Expect =
  /** Starts a new session for it. */
  | { kind: 'start' }
  /** Prompts the session it was given, and starts none. */
  | { kind: 'send' }
  /** Starts nothing and tells the person what it needs. */
  | { kind: 'tell' }
  /** Starts nothing on another host than the one named, and says where it stands. */
  | { kind: 'keep_host'; host: string }
  /** Starts nothing and does not say the blocker again. */
  | { kind: 'quiet' };

interface Bot {
  name: string;
  description: string;
  instructions: string;
}

interface Case {
  id: string;
  bot: string;
  closed: boolean;
  /** What the bot's earlier runs of the routine said, oldest first. */
  earlier: string[];
  /** Hosts that are offline in this run, by name. */
  offline?: string[];
  /** The routine's prompt, when the case has its own. */
  routine?: string;
  expect: Expect;
  why: string;
  /** Why the case is known to fail today: it is run and reported, and does not fail the eval. */
  open?: string;
}

interface Score {
  right: boolean;
  /** One letter: S started a session, s started one it should not, H kept to the named host, P prompted the session, T told the person, Q stayed quiet, r said the blocker again, - did nothing. */
  mark: string;
  note: string;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const MAX_PARALLEL = 6;
const MAX_TURNS = 8;
const SESSION_ID = '5e55e000-0000-4000-8000-0000000000cc';
const PRODUCTION = [
  'list_hosts',
  'list_sessions',
  'get_session',
  'read_session',
  'start_session',
  'send_to_session',
];
const NOTICES = ['notify', 'nothing_to_report'];

/** The session's log: its task done once, then closed or left at its prompt. */
function logOf(task: string, closed: boolean): LogSpec[] {
  const log: LogSpec[] = [
    { at: '2026-11-11T18:00:00Z', prompt: task },
    { at: '2026-11-11T18:00:20Z', started: true },
    { at: '2026-11-11T18:00:40Z', observed: 'working' },
    { at: '2026-11-11T18:04:00Z', result: 'No unresolved issues in the last 30 minutes.' },
    { at: '2026-11-11T18:04:05Z', observed: 'idle' },
  ];
  if (closed) log.push({ at: '2026-11-11T23:10:00Z', closed: true });
  return log;
}

/**
 * `notify` and `nothing_to_report` as the model sees them in production, run
 * by stand-ins: the real ones need the notices table and a turn's origin.
 */
function noticeTools(
  context: Parameters<ReturnType<BotNoticeToolsFactory['definitions']>[number]['bind']>[0],
): EvalTool[] {
  const definitions = new BotNoticeToolsFactory({} as never).definitions();
  return NOTICES.map((name) => {
    const definition = definitions.find((d) => d.name === name);
    if (!definition) throw new Error(`No production ${name}.`);
    const bound = definition.bind(context);
    return {
      name: bound.name,
      description: bound.description,
      inputSchema: bound.inputSchema,
      run: async () => ({
        content: name === 'notify' ? 'The notice is in their Inbox.' : quietTurnAnswer(),
      }),
    };
  });
}

/** `send_to_session` answering a closed session as the API does (`SESSIONS_005`). */
function refusingClosed(tool: EvalTool, closed: boolean): EvalTool {
  if (tool.name !== 'send_to_session' || !closed) return tool;
  return {
    ...tool,
    run: async () => ({ content: 'SESSIONS_005: That session is closed.', isError: true }),
  };
}

/** The message that opens the run: what earlier runs said, then the routine's note. */
function runMessage(c: Case, routine: { name: string; instructions: string }): string {
  const opening = routineOpening({
    automationId: 'automation-1',
    runId: 'run-1',
    name: routine.name,
    instructions: c.routine ?? routine.instructions,
  });
  if (c.earlier.length === 0) return opening;
  return [
    'Earlier in this chat, your own replies to this routine, oldest first:',
    ...c.earlier.map((line) => `- ${line}`),
    '',
    opening,
  ].join('\n');
}

/** What a run did, read once from its calls and its words. */
interface Did {
  started: TurnCall[];
  sent: TurnCall[];
  /** It wrote to the person, in the chat or in their Inbox. */
  said: boolean;
  hostId: (name: string) => string | undefined;
}

const inputOf = (call: TurnCall | undefined) => JSON.stringify(call?.input);
const overstepped = (did: Did): Score | null =>
  did.started.length > 0 ? { right: false, mark: 's', note: inputOf(did.started[0]) } : null;

/** One scorer per kind of expectation: adding a kind is a row here. */
const SCORERS: {
  [K in Expect['kind']]: (did: Did, expect: Extract<Expect, { kind: K }>) => Score;
} = {
  start: (did) =>
    did.started.length > 0
      ? { right: true, mark: 'S', note: inputOf(did.started[0]) }
      : did.said
        ? { right: false, mark: 'T', note: 'reported the blocker' }
        : { right: false, mark: '-', note: 'did nothing' },
  keep_host: (did, expect) => {
    const named = did.hostId(expect.host);
    const elsewhere = did.started.find(
      (call) => (call.input as { host_id?: string } | null)?.host_id !== named,
    );
    if (elsewhere) return { right: false, mark: 's', note: inputOf(elsewhere) };
    return did.said
      ? { right: true, mark: 'H', note: 'kept to the named host' }
      : { right: false, mark: '-', note: 'said nothing' };
  },
  send: (did) =>
    overstepped(did) ??
    (did.sent.length > 0
      ? { right: true, mark: 'P', note: 'prompted the session' }
      : { right: false, mark: did.said ? 'T' : '-', note: 'did not prompt the session' }),
  tell: (did) =>
    overstepped(did) ??
    (did.said
      ? { right: true, mark: 'T', note: 'told the person' }
      : { right: false, mark: 'Q', note: 'did not tell the person' }),
  // A quiet run writes nothing: nothing_to_report beside the blocker's words is the blocker said again.
  quiet: (did) =>
    overstepped(did) ??
    (did.said
      ? { right: false, mark: 'r', note: 'said the blocker again' }
      : { right: true, mark: 'Q', note: 'stayed quiet' }),
};

/**
 * What the chat keeps of a run's words: the run's calls and blocks of text
 * told in order to production's `QuietTurn`, which owns the rule, so a run
 * that goes quiet and then writes is scored as the person would see it.
 */
function keptWords(turn: Turn): string {
  const quiet = new QuietTurn<string>();
  let ended = 0;
  const end = (until: number) => {
    for (; ended < until; ended++) {
      const call = turn.calls[ended] as TurnCall;
      quiet.finished(call.tool, call.isError);
    }
  };
  for (const block of turn.blocks) {
    end(block.after);
    quiet.said(() => block.text);
  }
  end(turn.calls.length);
  quiet.ended();
  return quiet.words.join('\n');
}

/** A run against what its case expects, from the calls it made and what the chat keeps of its words. */
function scoreRun(turn: Turn, expect: Expect, hostId: (name: string) => string | undefined): Score {
  const made = (tool: string) => turn.calls.filter((call) => call.tool === tool && !call.isError);
  const did: Did = {
    started: made('start_session'),
    sent: made('send_to_session'),
    said: keptWords(turn).trim().length > 0 || made('notify').length > 0,
    hostId,
  };
  return (SCORERS[expect.kind] as (did: Did, expect: Expect) => Score)(did, expect);
}

async function main(): Promise<void> {
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
  const via = transport(process.env.BOT_BLOCKED_RUN_EVAL_MODEL ?? 'claude-sonnet-5-5');
  const runs = Number(arg('runs') ?? 3);
  const only = arg('case');
  const file = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8')) as {
    now: string;
    bots: Record<string, Bot>;
    hosts: HostSpec[];
    projects: ProjectSpec[];
    routine: { name: string; instructions: string };
    session: { name: string; task: string };
    cases: Case[];
  };
  const chosen = file.cases.filter((c) => !only || c.id === only);
  if (chosen.length === 0) throw new Error(`No case "${only}".`);
  const host = file.hosts[0] as HostSpec;
  const project = file.projects[0] as ProjectSpec;

  const hostsOf = (c: Case) =>
    file.hosts.map((h) => (c.offline?.includes(h.name) ? { ...h, online: false } : h));
  const spaceOf = (c: Case) =>
    workspace({
      home: host.name,
      hosts: hostsOf(c),
      projects: file.projects,
      sessions: [
        {
          id: SESSION_ID,
          name: file.session.name,
          host: host.name,
          project: project.name,
          log: logOf(file.session.task, c.closed),
        },
      ],
    });
  const toolsOf = (c: Case) => {
    const space = spaceOf(c);
    return [
      ...space.tools(PRODUCTION).map((tool) => refusingClosed(tool, c.closed)),
      ...noticeTools(space.context),
    ];
  };
  const contextOf = (c: Case) => {
    const hosts = hostsOf(c).map((h) => ({
      name: h.name,
      online: h.online,
      runningSessions: h.runningSessions ?? 0,
    }));
    return composeTurnContext({
      now: new Date(file.now),
      timeZone: 'Europe/Madrid',
      homeHost: hosts[0] ?? null,
      hosts,
      lastContext: null,
    });
  };
  const systemOf = (c: Case) => {
    const bot = file.bots[c.bot];
    if (!bot) throw new Error(`Case ${c.id} names no bot "${c.bot}".`);
    const groupOf = new Map(spaceOf(c).definitions.map((d) => [d.definition.name, d.group]));
    return composeBotSystemPrompt({
      name: bot.name,
      description: bot.description,
      soul: '',
      instructions: bot.instructions,
      facts: [],
      engineCapabilities: [],
      tools: toolsOf(c).map((tool) => ({
        name: tool.name,
        description: tool.description,
        group: (groupOf.get(tool.name) ?? 'self') as never,
      })),
    });
  };

  const jobs = chosen.flatMap((c) => Array.from({ length: runs }, () => c));
  const turns = await pool(jobs, MAX_PARALLEL, (c) =>
    via.turn({
      system: systemOf(c),
      message: withTurnContext(contextOf(c), runMessage(c, file.routine)),
      // A fresh workspace each run: nothing one run did is seen by another.
      tools: toolsOf(c),
      maxTurns: MAX_TURNS,
      maxTokens: 4096,
    }),
  );
  const results = chosen.map((c, i) => {
    const caseTurns = turns.slice(i * runs, (i + 1) * runs);
    const scores = caseTurns.map((turn) =>
      scoreRun(turn, c.expect, (name) => file.hosts.find((h) => h.name === name)?.id),
    );
    const right = scores.filter((score) => score.right).length;
    const passed = right * 2 > runs;
    return { ...c, turns: caseTurns, scores, right, passed };
  });

  const width = Math.max(...results.map((r) => r.id.length));
  for (const r of results) {
    console.log(
      `${r.passed ? 'pass' : r.open ? 'open' : 'FAIL'}  ${r.id.padEnd(width)}  want ${r.expect.kind.padEnd(9)}  got ${r.scores.map((s) => s.mark).join('')}  ${r.right}/${runs}`,
    );
    if (!r.passed) {
      r.scores.forEach((score, at) => {
        const turn = r.turns[at] as Turn;
        console.log(`        ${score.note}${turn.stopped ? ` [${turn.stopped}]` : ''}`);
        console.log(`        kept: ${keptWords(turn).replace(/\s+/g, ' ').slice(0, 240)}`);
        console.log(`        said: ${turn.answer.replace(/\s+/g, ' ').slice(0, 240)}`);
      });
    }
  }
  const total = results.length * runs;
  const right = results.reduce((sum, r) => sum + r.right, 0);
  const marked = (marks: string) =>
    results.reduce((sum, r) => sum + r.scores.filter((s) => marks.includes(s.mark)).length, 0);
  const stopped = results
    .filter((r) => r.expect.kind === 'start')
    .reduce((sum, r) => sum + r.scores.filter((s) => !s.right).length, 0);
  const overstepped = marked('s');
  const repeated = marked('r');
  const failed = results.filter((r) => !r.passed && !r.open).length;
  const open = results.filter((r) => !r.passed && r.open).length;
  console.log(
    `\n${via.model} (${via.engine}): ${right}/${total} runs right; ${stopped} stopped at a blocker it could have solved, ${overstepped} started a session it should not have, ${repeated} said a blocker again; ${failed} of ${results.length} cases failed, ${open} known open.`,
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
