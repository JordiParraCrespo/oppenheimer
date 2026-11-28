#!/usr/bin/env -S pnpm exec tsx
// Does a bot check back on async work it waits on, and speak at a look only
// when something moved?
//
// On 2026-11-23 Oppie started a release session, said it would verify the
// release before calling it done, and went silent until the owner asked
// "Have you finished?". A bot now sets its own look with `check_back` on
// anything it delegates or waits on (`product/design/bots/bot-subscriptions.md` §7.3), and a
// look speaks only when the work moved or needs help.
//
// Two kinds of case in `cases.json`: `ask`, a message from the person about
// work the bot waits on (or a plain question), and `look`, the turn a
// `check_back` look opens, with the production opening and ask, on a release
// session that stayed where the bot's last line left it, moved, or finished.
// The runner builds the bot's real system prompt and serves the production
// session tools over the in-memory workspace (`../bot-workspace.ts`), the
// production `check_back` over stand-in ports, and `notify` and
// `nothing_to_report` over stand-ins. A run is scored on its `check_back`
// calls and on the words the chat keeps of it (`keptWords`, production's
// `QuietTurn`).
//
//   pnpm eval:bot-check-back                       every case, 3 runs each
//   pnpm eval:bot-check-back --case look-moved     one case
//   pnpm eval:bot-check-back --runs 5
//   env: BOT_CHECK_BACK_EVAL_MODEL (default claude-sonnet-5-5)
//        ANTHROPIC_API_KEY: with it, the Messages API; without it, the
//        machine's Claude Code login, through the Agent SDK
//
// It passes when every case is right on a majority of its runs. Every run's
// calls and answer go to `reports/`.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BotCheckBackToolsFactory } from '../../../apps/api/src/bots-chat/application/bot-check-back-tools.factory';
import { BotNoticeToolsFactory } from '../../../apps/api/src/bots-chat/application/bot-notice-tools.factory';
import type { BotToolContext } from '../../../apps/api/src/bots-chat/application/bot-tool.factory';
import { checkBackPrompt } from '../../../apps/api/src/bots-chat/domain/bot-check-back.policy';
import { BotMessageEntity } from '../../../apps/api/src/bots-chat/domain/bot-message.entity';
import { composeBotSystemPrompt } from '../../../apps/api/src/bots-chat/domain/bot-prompt.policy';
import { promptText } from '../../../apps/api/src/bots-chat/domain/bot-prompt-text.policy';
import {
  QuietTurn,
  quietTurnAnswer,
} from '../../../apps/api/src/bots-chat/domain/bot-routine.policy';
import { formatToolTime } from '../../../apps/api/src/bots-chat/domain/bot-tool-text.policy';
import { BotTurnBudget } from '../../../apps/api/src/bots-chat/domain/bot-turn-budget.policy';
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
import {
  type HostSpec,
  type LogSpec,
  type ProjectSpec,
  type SessionSpec,
  workspace,
} from '../bot-workspace';

/** What a right run does. */
type Expect =
  /** Sets a look. */
  | 'check_back'
  /** Sets none: nothing is left pending. */
  | 'no_check_back'
  /** At a look where nothing moved: keeps no words and sets the next look. */
  | 'quiet_and_rearm'
  /** At a look where the work moved: says where it stands and sets the next look. */
  | 'say_and_rearm'
  /** At a look where the work is done: reports it and sets no more. */
  | 'report_and_stop';

interface SessionCase {
  name: string;
  task: string;
  log: (Omit<LogSpec, 'prompt'> & { prompt?: true })[];
  /** The agent's conversation, as `read_session_transcript` reads it. */
  transcript?: SessionSpec['transcript'];
}

interface Case {
  id: string;
  kind: 'ask' | 'look';
  session: string;
  message?: string;
  expect: Expect;
  why: string;
}

interface Score {
  right: boolean;
  /** One letter, as the README's table says. */
  mark: string;
  note: string;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const MAX_PARALLEL = 6;
const MAX_TURNS = 8;
const SESSION_ID = '5e55e000-0000-4000-8000-0000000000cc';
const CHAIN_ID = 'c0000000-0000-4000-8000-000000000001';
const PRODUCTION = [
  'list_hosts',
  'list_sessions',
  'get_session',
  'read_session',
  'read_session_transcript',
  'start_session',
  'send_to_session',
];
const CHECK_BACK = 'check_back';

/** `notify` and `nothing_to_report` as production shows them, run by stand-ins. */
function noticeTools(context: BotToolContext): EvalTool[] {
  const definitions = new BotNoticeToolsFactory({} as never).definitions();
  return ['notify', 'nothing_to_report'].map((name) => {
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

/**
 * The production `check_back`, over a stand-in store and the look's opening:
 * its own answers and refusals, the chain read as production reads it.
 */
function checkBackTool(context: BotToolContext, opening: BotMessageEntity | null): EvalTool {
  const factory = new BotCheckBackToolsFactory({ findOpening: async () => opening } as never, {
    schedule: async () => undefined,
  });
  const definition = factory.definitions().find((d) => d.name === CHECK_BACK);
  if (!definition) throw new Error('No production check_back.');
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

/** What the chat keeps of a run's words, told in order to production's `QuietTurn`. */
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

/** A run against what its case expects. */
function scoreRun(turn: Turn, expect: Expect): Score {
  const looks = turn.calls.filter((call) => call.tool === CHECK_BACK && !call.isError);
  const set = looks.length > 0;
  const kept = keptWords(turn).trim();
  const said = kept.length > 0;
  const note = `${set ? `check_back ${JSON.stringify(looks[0]?.input)}` : 'no check_back'}; kept: ${kept.replace(/\s+/g, ' ').slice(0, 200) || '(nothing)'}`;
  switch (expect) {
    case 'check_back': {
      if (set) return { right: true, mark: 'B', note };
      // A session it starts is followed by default, so starting one to do the
      // watching (a read-only session on CI with gh) also brings it back.
      const follows = turn.calls.some((call) => call.tool === 'start_session');
      return { right: follows, mark: follows ? 'F' : '-', note };
    }
    case 'no_check_back':
      return { right: !set, mark: set ? 'b' : '.', note };
    case 'quiet_and_rearm':
      if (!set) return { right: false, mark: '-', note };
      return { right: !said, mark: said ? 's' : 'Q', note };
    case 'say_and_rearm':
      if (!set) return { right: false, mark: '-', note };
      return { right: said, mark: said ? 'S' : 'q', note };
    case 'report_and_stop':
      if (set) return { right: false, mark: 'b', note };
      return { right: said, mark: said ? 'R' : 'q', note };
  }
}

async function main(): Promise<void> {
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
  const via = transport(process.env.BOT_CHECK_BACK_EVAL_MODEL ?? 'claude-sonnet-5-5');
  const runs = Number(arg('runs') ?? 3);
  const only = arg('case');
  const file = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8')) as {
    now: string;
    bot: { name: string; description: string; instructions: string };
    hosts: HostSpec[];
    projects: ProjectSpec[];
    sessions: Record<string, SessionCase>;
    lastLine: string;
    cases: Case[];
  };
  const chosen = file.cases.filter((c) => !only || c.id === only);
  if (chosen.length === 0) throw new Error(`No case "${only}".`);
  const host = file.hosts[0] as HostSpec;
  const project = file.projects[0] as ProjectSpec;
  const now = new Date(file.now);
  // The production check_back plans on the real clock, so the chain starts on
  // it too: anchored to the fixture's date, every re-arm would be past the
  // chain's 24 hours once the fixture is a day old.
  const chainStartedAt = new Date(Date.now() - 15 * 60_000);
  const about = `release session ${SESSION_ID}: verify runner 0.1.21 is live on dev stable with all four downloads`;

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
          transcript: session.transcript,
        },
      ],
    });
  };
  const openingOf = (c: Case) =>
    c.kind === 'look'
      ? BotMessageEntity.createNew({
          organizationId: 'org-1',
          botId: 'bot-1',
          turnId: 'turn-look',
          role: 'event',
          content: 'look',
          event: {
            kind: 'check_back',
            chainId: CHAIN_ID,
            step: 1,
            chainStartedAt: chainStartedAt.toISOString(),
            about,
          },
          steps: [],
          position: 0,
        })
      : null;
  const toolsOf = (c: Case) => {
    const space = spaceOf(c);
    // A fresh budget each run, and the turn's origin and lane as production gives them.
    const context: BotToolContext = {
      ...space.context,
      budget: new BotTurnBudget(),
      origin: c.kind === 'look' ? 'check_back' : 'message',
      lane: c.kind === 'look' ? 'background' : 'owner',
    };
    return [
      ...space.tools(PRODUCTION),
      checkBackTool(context, openingOf(c)),
      ...noticeTools(context),
    ];
  };
  const messageOf = (c: Case) => {
    if (c.kind === 'ask') return c.message ?? '';
    const opening = promptText('core/wake-check-back.opening', {
      look: '2',
      startedAt: formatToolTime(chainStartedAt, 'Europe/Madrid'),
      about,
    });
    // The eval's transport sends one message: the chat's last line about it opens it.
    return `Your last line in this chat about it, at the previous look: "${file.lastLine}"\n\n${checkBackPrompt(opening)}`;
  };
  const turnContext = composeTurnContext({
    now,
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
    const tools = toolsOf(c);
    const groupOf = new Map(spaceOf(c).definitions.map((d) => [d.definition.name, d.group]));
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

  const jobs = chosen.flatMap((c) => Array.from({ length: runs }, () => c));
  const turns = await pool(jobs, MAX_PARALLEL, (c) =>
    via.turn({
      system: systemOf(c),
      message: withTurnContext(turnContext, messageOf(c)),
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
      `${r.passed ? 'pass' : 'FAIL'}  ${r.id.padEnd(width)}  want ${r.expect.padEnd(15)}  got ${r.scores.map((s) => s.mark).join('')}  ${r.right}/${runs}`,
    );
    if (!r.passed) {
      r.scores.forEach((score, at) => {
        const turn = r.turns[at] as Turn;
        console.log(`        ${score.note}${turn.stopped ? ` [${turn.stopped}]` : ''}`);
      });
    }
  }
  const total = results.length * runs;
  const right = results.reduce((sum, r) => sum + r.right, 0);
  const forgot = results
    .filter((r) => r.expect !== 'no_check_back' && r.expect !== 'report_and_stop')
    .reduce((sum, r) => sum + r.scores.filter((s) => s.mark === '-').length, 0);
  const failed = results.filter((r) => !r.passed).length;
  console.log(
    `\n${via.model} (${via.engine}): ${right}/${total} runs right; ${forgot} left pending work with no look set; ${failed} of ${results.length} cases failed.`,
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
