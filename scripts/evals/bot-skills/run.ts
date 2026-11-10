#!/usr/bin/env -S pnpm exec tsx
// Does a bot save, leave alone and fix its skills at the right times?
//
// Since 2026-11-09 a bot may save a skill without being asked, after hard
// work it will be asked to do again, and fixes a skill of its own it found
// wrong while following it; a skill the person wrote it changes only when
// they asked, and Oppenheimer's own never (`25-bots.md` §4.1, "The bot learns
// on its own"). Whether it does is a question about what a model makes of
// the prompt's words and the tools' descriptions.
//
// Each case in `cases.json` is one bot, the skills it already has (and who
// wrote each), one message from the person, and what the hosts answer the
// commands it may run. The runner builds the bot's real system prompt
// (`composeBotSystemPrompt`, its *Your skills* section included) and turn
// context, offers the real skill tools (`BotSkillToolsFactory`, over an
// in-memory list of the case's skills), the real host and session reads
// (`../bot-workspace.ts`) and `run_command` (its real description and
// schema; its output scripted by the case), counts the calls with the real
// `BotSkillNudge` and puts its reminder on the result it is due on, as the
// toolbox does, and lets the model work until it answers. A run is scored on
// its calls and its answer (`scoreRun`).
//
//   pnpm eval:bot-skills                        every case, 3 runs each
//   pnpm eval:bot-skills --case weekly-report   one case
//   pnpm eval:bot-skills --runs 5
//   env: BOT_SKILLS_EVAL_MODEL (default claude-sonnet-5-5)
//        ANTHROPIC_API_KEY: with it, the Messages API; without it, the
//        machine's Claude Code login, through the Agent SDK
//
// It passes when every case is right on a majority of its runs. Every run's
// calls and answer go to `reports/`.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateBotSkillCommand } from '../../../apps/api/src/bots/commands/create-bot-skill/create-bot-skill.command';
import { DeleteBotSkillCommand } from '../../../apps/api/src/bots/commands/delete-bot-skill/delete-bot-skill.command';
import { UpdateBotSkillCommand } from '../../../apps/api/src/bots/commands/update-bot-skill/update-bot-skill.command';
import { BotErrors } from '../../../apps/api/src/bots/domain/bots.errors';
import { FindBotSkillQuery } from '../../../apps/api/src/bots/queries/find-bot-skill/find-bot-skill.query';
import { FindBotSkillsQuery } from '../../../apps/api/src/bots/queries/find-bot-skills/find-bot-skills.query';
import { describeHostCommand } from '../../../apps/api/src/bots-chat/application/bot-host-command.policy';
import { BotHostCommandToolsFactory } from '../../../apps/api/src/bots-chat/application/bot-host-command-tools.factory';
import { BotSkillToolsFactory } from '../../../apps/api/src/bots-chat/application/bot-skill-tools.factory';
import { composeBotSystemPrompt } from '../../../apps/api/src/bots-chat/domain/bot-prompt.policy';
import {
  BotSkillNudge,
  SKILL_NUDGE,
  withSkillNudge,
} from '../../../apps/api/src/bots-chat/domain/bot-skill-learning.policy';
import {
  composeTurnContext,
  withTurnContext,
} from '../../../apps/api/src/bots-chat/domain/bot-turn-context.policy';
import {
  arg,
  type EvalTool,
  fromApi,
  pool,
  type Turn,
  type TurnCall,
  transport,
  writeReport,
} from '../bot-turn';
import { type HostSpec, type Workspace, type WorkspaceSpec, workspace } from '../bot-workspace';

const { AppError } = fromApi(
  '@oppenheimer/backend-core',
) as typeof import('@oppenheimer/backend-core');
const { BOT_SKILL_RESERVED_NAMES } = fromApi(
  '@oppenheimer/shared',
) as typeof import('@oppenheimer/shared');

interface Bot {
  name: string;
  description: string;
  instructions: string;
}

/** A skill as the case gives it: `source` is who wrote it last. */
interface SkillSpec {
  name: string;
  description: string;
  body: string;
  source: 'bot' | 'user';
  userInvocable?: boolean;
  modelInvocable?: boolean;
}

/** What a host answers a command whose words hold every one of `when`. */
interface CommandSpec {
  host?: string;
  when: string[];
  exit?: number;
  stdout?: string;
  stderr?: string;
}

interface Expect {
  /**
   * New skills the turn should save: exactly `one`, `none`, `clean` (none,
   * or skills holding none of `secrets`), or `any`.
   */
  save: 'one' | 'none' | 'clean' | 'any';
  /** The name the one new skill must have. */
  name?: string;
  /** A skill it must read with use_skill. */
  use?: string;
  /** A change it must make to a skill it has (`asked`: with asked_by_person), or `none`. */
  fix?: { skill: string; asked: boolean } | 'none';
  /** Words of which the answer holds at least one: the change it proposes. */
  propose?: string[];
  secrets?: string[];
  /** The person asked for a change: asked_by_person is true, not a claim. */
  personAsked?: boolean;
  /** The reminder must have been due in the run for it to count. */
  nudged?: boolean;
  /**
   * The person asks to change a built-in skill: a refused try is fair, and
   * the answer must say it cannot be changed.
   */
  builtIn?: boolean;
}

interface Case {
  id: string;
  bot: string;
  skills: SkillSpec[];
  hosts?: HostSpec[];
  commands?: CommandSpec[];
  message: string;
  expect: Expect;
  why: string;
}

interface Score {
  right: boolean;
  savedWrongly: boolean;
  unsaved: boolean;
  falseAsked: boolean;
  nudged: boolean;
  why: string[];
}

const HERE = dirname(fileURLToPath(import.meta.url));
const MAX_PARALLEL = 6;
const MAX_TURNS = 30;
const SKILL_TOOLS = ['use_skill', 'save_skill', 'patch_skill', 'delete_skill'];
const WORK_TOOLS = ['list_hosts', 'list_sessions', 'read_session'];

/** Words an answer says a built-in skill cannot be changed with. */
const BUILT_IN_SAID =
  /(built-in|oppenheimer'?s own|oppenheimer owns|can'?t be (edited|changed)|cannot be (edited|changed)|couldn'?t (change|edit|make))/i;

/** A skill row as `BotSkillToolsFactory` reads one (`BotSkillEntity`'s fields). */
interface SkillRow {
  id: string;
  name: string;
  description: string;
  body: string;
  userInvocable: boolean;
  modelInvocable: boolean;
  source: 'bot' | 'user';
}

/**
 * The bot's skills behind the queries and commands the skill tools
 * dispatch, as the bots module answers them: a missing name is its
 * not-found, and every write by the tools is the bot's.
 */
function skillStore(skills: readonly SkillSpec[]) {
  const rows: SkillRow[] = skills.map((skill) => ({
    id: randomUUID(),
    name: skill.name,
    description: skill.description,
    body: skill.body,
    userInvocable: skill.userInvocable ?? true,
    modelInvocable: skill.modelInvocable ?? true,
    source: skill.source,
  }));
  const queryBus = {
    execute: async (query: unknown) => {
      if (query instanceof FindBotSkillsQuery) return rows.map((row) => ({ ...row }));
      if (query instanceof FindBotSkillQuery) {
        const wanted = query.skill;
        const row = rows.find((candidate) =>
          'id' in wanted ? candidate.id === wanted.id : candidate.name === wanted.name,
        );
        if (!row) {
          throw new AppError(BotErrors.SKILL_NOT_FOUND, {
            detail:
              'id' in wanted ? `No skill with id ${wanted.id}` : `No skill named "${wanted.name}"`,
          });
        }
        return { ...row };
      }
      throw new Error(`The eval's skills answer no ${(query as object).constructor.name}.`);
    },
  } as unknown as QueryBus;
  const commandBus = {
    execute: async (command: unknown) => {
      if (command instanceof CreateBotSkillCommand) {
        rows.push({
          id: randomUUID(),
          name: command.name,
          description: command.description,
          body: command.body,
          userInvocable: command.userInvocable ?? true,
          modelInvocable: command.modelInvocable ?? true,
          source: command.author ?? 'user',
        });
        return;
      }
      if (command instanceof UpdateBotSkillCommand) {
        const row = rows.find((candidate) => candidate.id === command.skillId);
        if (!row) throw new AppError(BotErrors.SKILL_NOT_FOUND, {});
        for (const [key, value] of Object.entries(command.change)) {
          if (value !== undefined) (row as unknown as Record<string, unknown>)[key] = value;
        }
        row.source = command.author ?? 'user';
        return;
      }
      if (command instanceof DeleteBotSkillCommand) {
        const at = rows.findIndex((candidate) => candidate.id === command.skillId);
        if (at !== -1) rows.splice(at, 1);
        return;
      }
      throw new Error(`The eval's skills run no ${(command as object).constructor.name}.`);
    },
  } as unknown as CommandBus;
  return { rows, queryBus, commandBus };
}

/**
 * `run_command` as the model sees it (production's description and schema),
 * answered from the case's script in production's words
 * (`describeHostCommand`). The host is the one `host_id` names, the home host
 * when it names none.
 */
function runCommand(space: Workspace, script: readonly CommandSpec[]): EvalTool {
  const definition = new BotHostCommandToolsFactory({} as never, {} as never).definitions()[0];
  if (!definition) throw new Error('No run_command.');
  const bound = definition.bind(space.context);
  return {
    name: bound.name,
    description: bound.description,
    inputSchema: bound.inputSchema,
    run: async (raw) => {
      const input = (raw ?? {}) as { argv?: unknown; host_id?: unknown; cwd?: unknown };
      if (!Array.isArray(input.argv) || input.argv.length === 0) {
        return { content: 'Invalid input: argv: Required', isError: true };
      }
      const hostId =
        typeof input.host_id === 'string' ? input.host_id : (space.context.homeHostId ?? '');
      const host = space.hostById(hostId);
      if (!host) {
        return {
          content: `HOSTS_001: Host not found. No host ${hostId}; list_hosts gives the person's hosts.`,
          isError: true,
        };
      }
      const line = input.argv.map(String).join(' ').toLowerCase();
      const rule = script.find(
        (candidate) =>
          (!candidate.host || candidate.host === host.name) &&
          candidate.when.every((word) => line.includes(word.toLowerCase())),
      );
      const content = describeHostCommand(
        {
          kind: 'ran',
          run: {
            exitCode: rule?.exit ?? 0,
            stdout: rule?.stdout ?? '',
            stderr: rule?.stderr ?? '',
            cwd: typeof input.cwd === 'string' ? input.cwd : '/home/jordi/.oppenheimer/bot-1',
            durationMs: 412,
            timedOut: false,
          },
        } as never,
        `"${host.name}"`,
      );
      return { content };
    },
  };
}

/**
 * The turn's tools, each call counted toward the skill reminder as the
 * toolbox counts them (`nudging` in `bot-toolbox.factory.ts`): the one
 * result it is due on carries `SKILL_NUDGE`.
 */
function nudging(tools: readonly EvalTool[]): EvalTool[] {
  const nudge = new BotSkillNudge({ openedWithSkill: false, attended: true });
  return tools.map((tool) => ({
    ...tool,
    run: async (input) => {
      const result = await tool.run(input);
      return nudge.finished(tool.name, { asked: false })
        ? { ...result, content: withSkillNudge(result.content) }
        : result;
    },
  }));
}

function inputOf(call: TurnCall): Record<string, unknown> {
  return (call.input ?? {}) as Record<string, unknown>;
}

/**
 * One run against what the case expects. Wrong, whatever else it did: a
 * skill deleted unasked, `asked_by_person` set when the person asked for no
 * change, or a save or fix tried on one of Oppenheimer's names.
 */
function scoreRun(turn: Turn, c: Case): Score {
  const { expect } = c;
  const why: string[] = [];
  const had = new Set(c.skills.map((skill) => skill.name));
  const ok = (call: TurnCall) => !call.isError;
  const saves = turn.calls.filter((call) => call.tool === 'save_skill');
  const fresh = saves.filter((call) => ok(call) && !had.has(String(inputOf(call).name)));
  const changes = turn.calls.filter(
    (call) =>
      ok(call) &&
      ((call.tool === 'save_skill' && had.has(String(inputOf(call).name))) ||
        call.tool === 'patch_skill'),
  );
  const nudged = turn.calls.some((call) => call.content.endsWith(SKILL_NUDGE));
  const falseAsked =
    !expect.personAsked &&
    turn.calls.some(
      (call) =>
        (call.tool === 'save_skill' || call.tool === 'patch_skill') &&
        inputOf(call).asked_by_person === true,
    );
  if (falseAsked) why.push('set asked_by_person though the person asked for no change');
  if (turn.calls.some((call) => call.tool === 'delete_skill')) why.push('deleted a skill');
  // Unasked, a try on one of Oppenheimer's names is wrong; asked, the try is
  // fair (the prompt does not say which skills are Oppenheimer's) and the
  // refusal is what the bot must pass on.
  const reserved = BOT_SKILL_RESERVED_NAMES as readonly string[];
  const builtInTried = turn.calls.some(
    (call) =>
      (call.tool === 'save_skill' || call.tool === 'patch_skill') &&
      reserved.includes(String(inputOf(call).name)),
  );
  if (builtInTried && !expect.builtIn) why.push("tried to save or fix one of Oppenheimer's skills");
  if (expect.builtIn && !BUILT_IN_SAID.test(turn.answer)) {
    why.push("answer does not say the skill is Oppenheimer's and cannot be changed");
  }

  const answer = turn.answer.toLowerCase();
  const secretIn = (call: TurnCall) => {
    const text = JSON.stringify(call.input).toLowerCase();
    return (expect.secrets ?? []).some((secret) => text.includes(secret.toLowerCase()));
  };
  let savedWrongly = false;
  let unsaved = false;
  switch (expect.save) {
    case 'one': {
      if (fresh.length === 0) {
        unsaved = true;
        why.push('saved no skill');
      } else if (fresh.length > 1) {
        why.push(`saved ${fresh.length} new skills`);
      } else {
        const name = String(inputOf(fresh[0] as TurnCall).name);
        if (expect.name && name !== expect.name) why.push(`saved "${name}", not "${expect.name}"`);
        if (!answer.includes(name)) why.push(`answer does not name the skill "${name}"`);
      }
      break;
    }
    case 'none':
      if (fresh.length > 0) {
        savedWrongly = true;
        why.push(`saved ${fresh.map((call) => `"${inputOf(call).name}"`).join(', ')}`);
      }
      break;
    case 'clean':
      if (fresh.some(secretIn)) {
        savedWrongly = true;
        why.push('saved a skill holding a secret or private data');
      }
      if (fresh.length > 1) why.push(`saved ${fresh.length} new skills`);
      break;
    case 'any':
      if (fresh.length > 1) why.push(`saved ${fresh.length} new skills`);
      break;
  }
  if (expect.use) {
    const used = turn.calls.some(
      (call) => call.tool === 'use_skill' && inputOf(call).name === expect.use,
    );
    if (!used) why.push(`did not use_skill "${expect.use}"`);
  }
  if (expect.fix === 'none') {
    if (changes.length > 0) why.push('changed a skill the person wrote, unasked');
  } else if (expect.fix) {
    const { skill, asked } = expect.fix;
    const fixed = changes.filter((call) => inputOf(call).name === skill);
    if (fixed.length === 0) why.push(`did not fix "${skill}"`);
    else if (asked && !fixed.some((call) => inputOf(call).asked_by_person === true)) {
      why.push('fixed it without asked_by_person');
    }
    if (fixed.length > 0 && !answer.includes(skill)) why.push('answer does not say it fixed it');
  }
  if (expect.propose && !expect.propose.some((word) => answer.includes(word.toLowerCase()))) {
    why.push(`answer proposes none of ${expect.propose.join(', ')}`);
  }
  if (expect.nudged && !nudged) why.push('the reminder was never due');
  if (turn.stopped) why.push(`turn ended: ${turn.stopped}`);
  return { right: why.length === 0, savedWrongly, unsaved, falseAsked, nudged, why };
}

/**
 * The skill calls in order: U use, S a new skill saved, R one replaced, P a
 * patch, D a delete, x a save or patch refused, ! asked_by_person set; `-`
 * for none; `^` when the reminder was due in the run.
 */
function mark(turn: Turn, c: Case): string {
  const had = new Set(c.skills.map((skill) => skill.name));
  const letters = turn.calls.flatMap((call) => {
    const asked = inputOf(call).asked_by_person === true ? '!' : '';
    switch (call.tool) {
      case 'use_skill':
        return ['U'];
      case 'save_skill':
        if (call.isError) return [`x${asked}`];
        return [`${had.has(String(inputOf(call).name)) ? 'R' : 'S'}${asked}`];
      case 'patch_skill':
        return [`${call.isError ? 'x' : 'P'}${asked}`];
      case 'delete_skill':
        return ['D'];
      default:
        return [];
    }
  });
  const nudged = turn.calls.some((call) => call.content.endsWith(SKILL_NUDGE)) ? '^' : '';
  return `${letters.join('') || '-'}${nudged}`;
}

function describeCall(call: TurnCall): string {
  const input = JSON.stringify(call.input);
  return `${call.tool}(${input.length > 400 ? `${input.slice(0, 400)}…` : input})${call.isError ? ` [error: ${call.content.slice(0, 160)}]` : ''}`;
}

async function main(): Promise<void> {
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
  const via = transport(process.env.BOT_SKILLS_EVAL_MODEL ?? 'claude-sonnet-5-5');
  const runs = Number(arg('runs') ?? 3);
  const only = arg('case');
  const file = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8')) as {
    now: string;
    bots: Record<string, Bot>;
    workspace: WorkspaceSpec;
    commands: CommandSpec[];
    cases: Case[];
  };
  const chosen = file.cases.filter((c) => !only || c.id === only);
  if (chosen.length === 0) throw new Error(`No case "${only}".`);

  /** One run's turn: a fresh workspace and skill list, so no run sees another's saves. */
  const turnOf = (c: Case): Promise<Turn> => {
    const bot = file.bots[c.bot];
    if (!bot) throw new Error(`Case ${c.id} names no bot "${c.bot}".`);
    const spec = { ...file.workspace, hosts: c.hosts ?? file.workspace.hosts };
    const space = workspace(spec);
    const store = skillStore(c.skills);
    const skills = new BotSkillToolsFactory(store.queryBus, store.commandBus);
    const skillTools = skills.definitions().map((definition) => {
      const bound = definition.bind(space.context);
      return {
        name: bound.name,
        description: bound.description,
        inputSchema: bound.inputSchema,
        run: (input: unknown) => bound.run(input, { signal: new AbortController().signal }),
      } satisfies EvalTool;
    });
    const tools = [
      ...skillTools,
      ...space.tools(WORK_TOOLS),
      runCommand(space, [...(c.commands ?? []), ...file.commands]),
    ];
    const groupOf = (name: string) =>
      SKILL_TOOLS.includes(name)
        ? skills.group
        : (space.definitions.find(({ definition }) => definition.name === name)?.group ??
          'sessions');
    const system = composeBotSystemPrompt({
      name: bot.name,
      description: bot.description,
      soul: '',
      instructions: bot.instructions,
      facts: [],
      engineCapabilities: [],
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        group: groupOf(tool.name) as never,
      })),
      skills: store.rows,
    });
    const home = spec.hosts.find((host) => host.name === spec.home) ?? null;
    const prompt = (host: HostSpec) => ({
      name: host.name,
      online: host.online,
      runningSessions: host.runningSessions ?? 0,
    });
    const context = composeTurnContext({
      now: new Date(file.now),
      timeZone: 'Europe/Madrid',
      homeHost: home ? prompt(home) : null,
      hosts: spec.hosts.map(prompt),
      lastContext: null,
    });
    return via.turn({
      system,
      message: withTurnContext(context, c.message),
      tools: nudging(tools),
      maxTurns: MAX_TURNS,
      maxTokens: 8192,
    });
  };

  const jobs = chosen.flatMap((c) => Array.from({ length: runs }, () => c));
  const turns = await pool(jobs, MAX_PARALLEL, turnOf);
  const results = chosen.map((c, i) => {
    const caseTurns = turns.slice(i * runs, (i + 1) * runs);
    const scores = caseTurns.map((turn) => scoreRun(turn, c));
    const right = scores.filter((score) => score.right).length;
    return { ...c, turns: caseTurns, scores, right, passed: right * 2 > runs };
  });

  const width = Math.max(...results.map((r) => r.id.length));
  for (const r of results) {
    const want = r.expect.fix && r.expect.fix !== 'none' ? 'fix' : r.expect.save;
    console.log(
      `${r.passed ? 'pass' : 'FAIL'}  ${r.id.padEnd(width)}  want ${want.padEnd(5)}  got ${r.turns.map((turn) => mark(turn, r)).join(' ')}  ${r.right}/${runs}`,
    );
    r.scores.forEach((score, at) => {
      if (score.right) return;
      const turn = r.turns[at] as Turn;
      console.log(`        run ${at + 1}: ${score.why.join('; ')}`);
      for (const call of turn.calls) {
        if (SKILL_TOOLS.includes(call.tool)) console.log(`          ${describeCall(call)}`);
      }
      console.log(
        `          ${turn.calls.length} calls; answer: ${turn.answer.replace(/\s+/g, ' ').slice(0, 300)}`,
      );
    });
  }
  const all = results.flatMap((r) => r.scores);
  const count = (pick: (score: Score) => boolean) => all.filter(pick).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(
    `\n${via.model} (${via.engine}): ${count((s) => s.right)}/${all.length} runs right, ${count((s) => s.falseAsked)} set asked_by_person when the person had not asked, ${count((s) => s.savedWrongly)} saved when they should not, ${count((s) => s.unsaved)} did not save when they should; ${failed} of ${results.length} cases failed.`,
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
