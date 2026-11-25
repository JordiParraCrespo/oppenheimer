import type { BotToolGroup } from '@oppenheimer/shared';
import { type PlainPromptId, promptText } from './bot-prompt-text.policy';
import { hostCases } from './bot-recovery.policy';
import type { BotBuiltInSkill } from './bot-skill.types';

/**
 * What a capability's sections are decided from: the tools the turn offers,
 * and what they let it do on a host.
 */
export interface CapabilityFacts {
  /** The names of the tools the turn offers. */
  offered: readonly string[];
  /** Whether the turn may start a session, run a command, and which terminal tools it has. */
  sessions: boolean;
  commands: boolean;
  terminals: ReadonlySet<string>;
}

/** What a new bot's hello says of one area of tools (`gettingStarted`). */
export interface AreaIntro {
  /** What the bot can do there, in the greeting's list. */
  does: PlainPromptId;
  /** The tools that do it: the area is offered when the turn has any of them. */
  doneBy: readonly string[];
  /** What the person may still have to connect for it, named in the offer to help. */
  connects?: PlainPromptId;
  /** A job this area makes possible, among the examples Getting started offers. */
  example?: PlainPromptId;
}

/**
 * One thing a bot can do, and everything the prompt says about it
 * (2026-11-23): the prompt's core (who the bot is, how a turn goes, the
 * rules) names no capability; it reads this list. A capability's words are
 * the folder of its `name` under `prompts/`, and a new one is a row here and
 * a folder there.
 */
export interface BotCapability {
  /** Its folder under `prompts/`, where every word about it is. */
  name: string;
  /** The tool group whose tools it lists in "What you can do", and the label it lists them under. */
  lists?: { group: Exclude<BotToolGroup, 'self'>; label: string };
  /** What a new bot's hello says of it, keyed by the tools that act. */
  intros: readonly AreaIntro[];
  /** The system prompt's sections that hold on every turn offering its tools, in order; null leaves one out. */
  sections: readonly ((facts: CapabilityFacts) => string | null)[];
  /** Its how-to that only some turns need, read with `use_skill` when the work comes up. */
  skills: readonly BotBuiltInSkill[];
}

/**
 * A capability's skill: how-to that only some turns need, kept out of the
 * system prompt and read with `use_skill` when the work comes up, as Codex
 * and OpenClaw keep theirs. Its words are `<capability>/skill-<name>.md` in
 * the Agent Skills format; the model uses it unasked, and the person does
 * not run it. Listed only to a turn offering every tool in `needsTools`.
 */
function capabilitySkill(
  name: 'watch-inbox' | 'use-a-computer' | 'use-a-browser',
  words: { description: string; body: string },
  needsTools: readonly string[],
): BotBuiltInSkill {
  return { name, ...words, needsTools, userInvocable: false, modelInvocable: true };
}

/** Offering to watch the inbox, read when the person talks about email. */
export const WATCH_INBOX_SKILL = capabilitySkill(
  'watch-inbox',
  {
    description: promptText('mail/skill-watch-inbox.description'),
    body: promptText('mail/skill-watch-inbox.body'),
  },
  ['search_mail', 'update_routine'],
);

/** Working a screen step by step, read before the first `use_computer`. */
export const USE_A_COMPUTER_SKILL = capabilitySkill(
  'use-a-computer',
  {
    description: promptText('computer/skill-use-a-computer.description'),
    body: promptText('computer/skill-use-a-computer.body'),
  },
  ['use_computer'],
);

/** Working a page step by step, read before the first `use_browser`. */
export const USE_A_BROWSER_SKILL = capabilitySkill(
  'use-a-browser',
  {
    description: promptText('browser/skill-use-a-browser.description'),
    body: promptText('browser/skill-use-a-browser.body'),
  },
  ['use_browser'],
);

/**
 * Every capability, in the order the prompt lists them: "What you can do"
 * lists their tool groups in it (after the bot's own, `self`), the sections
 * come in it, and so do a new bot's hello and its job examples.
 */
export const BOT_CAPABILITIES: readonly BotCapability[] = [
  {
    name: 'sessions',
    lists: { group: 'sessions', label: 'Hosts and sessions' },
    intros: [
      {
        does: 'sessions/system-intro.hosts-does',
        doneBy: ['start_session', 'start_cloud_session'],
        connects: 'sessions/system-intro.hosts-connects',
        example: 'sessions/system-intro.hosts-example',
      },
      { does: 'sessions/system-intro.commands-does', doneBy: ['run_command'] },
    ],
    sections: [
      ({ sessions, commands, terminals }) =>
        sessions ? workingOnCode(commands, terminals.size > 0) : null,
      ({ commands }) => (commands ? promptText('sessions/system-commands-on-a-host') : null),
      ({ commands, terminals }) =>
        terminals.size > 0 ? drivingATerminal(commands, terminals) : null,
    ],
    skills: [],
  },
  {
    name: 'computer',
    intros: [],
    sections: [
      ({ offered }) => (offered.includes('use_computer') ? promptText('computer/system') : null),
    ],
    skills: [USE_A_COMPUTER_SKILL],
  },
  {
    name: 'browser',
    intros: [],
    sections: [
      ({ offered }) =>
        offered.includes('use_browser') ? usingABrowser(offered.includes('use_computer')) : null,
    ],
    skills: [USE_A_BROWSER_SKILL],
  },
  {
    name: 'plan',
    lists: { group: 'plan', label: 'Plan and projects' },
    intros: [
      {
        does: 'plan/system-intro.does',
        doneBy: ['create_task', 'update_task'],
        example: 'plan/system-intro.example',
      },
    ],
    sections: [],
    skills: [],
  },
  {
    name: 'github',
    lists: { group: 'github', label: 'GitHub' },
    intros: [
      {
        does: 'github/system-intro.does',
        doneBy: ['review_pull_request', 'comment_on_pull_request', 'create_issue'],
        connects: 'github/system-intro.connects',
        example: 'github/system-intro.example',
      },
    ],
    sections: [],
    skills: [],
  },
  {
    name: 'routines',
    lists: { group: 'automations', label: 'Automations and routines' },
    intros: [
      {
        does: 'routines/system-intro.does',
        doneBy: ['update_routine'],
        example: 'routines/system-intro.example',
      },
    ],
    sections: [],
    skills: [],
  },
  {
    name: 'mail',
    lists: { group: 'mail', label: 'Gmail' },
    intros: [
      {
        does: 'mail/system-intro.does',
        doneBy: ['send_mail', 'send_draft'],
        connects: 'mail/system-intro.connects',
        example: 'mail/system-intro.example',
      },
    ],
    sections: [],
    skills: [WATCH_INBOX_SKILL],
  },
  {
    name: 'whatsapp',
    lists: { group: 'whatsapp', label: 'WhatsApp' },
    intros: [
      {
        does: 'whatsapp/system-intro.does',
        doneBy: ['send_whatsapp_message'],
        connects: 'whatsapp/system-intro.connects',
      },
    ],
    sections: [],
    skills: [],
  },
  {
    name: 'telegram',
    lists: { group: 'telegram', label: 'Telegram' },
    intros: [
      {
        does: 'telegram/system-intro.does',
        doneBy: ['send_telegram_message'],
        connects: 'telegram/system-intro.connects',
      },
    ],
    sections: [],
    skills: [],
  },
  {
    name: 'bots',
    lists: { group: 'bots', label: 'Other bots' },
    intros: [
      { does: 'bots/system-intro.does', doneBy: ['message_bot', 'create_bot', 'update_bot'] },
    ],
    sections: [],
    skills: [],
  },
  {
    name: 'web',
    lists: { group: 'web', label: 'The web and subagents' },
    intros: [
      { does: 'web/system-intro.does', doneBy: ['web_fetch'], example: 'web/system-intro.example' },
    ],
    sections: [],
    skills: [],
  },
];

/**
 * How a bot uses its browser. `computer` says it also has `use_computer`, so
 * it is told which of the two a website goes to.
 */
function usingABrowser(computer: boolean): string {
  return promptText('browser/system.body', {
    besideAComputer: computer ? `\n- ${promptText('browser/system.not-the-computer')}` : '',
  });
}

/**
 * The rest of the delegate bullet, by what the bot has: a bot with no way to
 * run anything is told it never does; one with `run_command` where the line
 * with a session falls; one with a terminal, nothing that says it never sees
 * one.
 */
function delegateTail(commands: boolean, terminals: boolean): string {
  if (commands) {
    return ` ${promptText(
      terminals
        ? 'sessions/system-working-on-code.run-command-or-session-with-terminal'
        : 'sessions/system-working-on-code.run-command-or-session',
    )}`;
  }
  return terminals ? '' : ` ${promptText('sessions/system-working-on-code.never-runs-commands')}`;
}

/**
 * Real work on code is a session on a host: every
 * bot that may start one is told so here, once, rather than each owner
 * writing it into INSTRUCTIONS.md. The host order is `sessionHostId`'s.
 * Static per tool set, so the prompt stays the same bytes; the hosts of the moment are
 * the turn context's.
 */
function workingOnCode(commands: boolean, terminals: boolean): string {
  const opening = promptText(
    terminals
      ? 'sessions/system-working-on-code.delegates-code-work'
      : 'sessions/system-working-on-code.delegates-not-a-terminal',
  );
  return promptText('sessions/system-working-on-code.body', {
    delegate: `${opening}${delegateTail(commands, terminals)}`,
    hostCases: hostCases(),
  });
}

/** The terminal tools: any one offered is a terminal to explain. */
export const TERMINAL_TOOL_NAMES = ['open_terminal', 'type_in_terminal', 'read_terminal'] as const;

/**
 * How to drive a terminal, built
 * from the terminal tools the turn is offered, since the owner turns each
 * on or off: a bot is never told to open or type with a tool it lacks. The
 * same bytes for the same tool set.
 */
function drivingATerminal(commands: boolean, tools: ReadonlySet<string>): string {
  const named = TERMINAL_TOOL_NAMES.filter((name) => tools.has(name)).map((name) => `\`${name}\``);
  const has: TerminalTools = {
    commands,
    opens: tools.has('open_terminal'),
    types: tools.has('type_in_terminal'),
    reads: tools.has('read_terminal'),
  };
  const lines = TERMINAL_LINES.filter((line) => line.when(has)).map(
    (line) => `- ${promptText(line.id)}`,
  );
  return promptText('sessions/system-driving-a-terminal.body', {
    tools: named.join(', '),
    lines: lines.join('\n'),
  });
}

/** What a bot has, as the terminal section's lines read it. */
interface TerminalTools {
  commands: boolean;
  opens: boolean;
  types: boolean;
  reads: boolean;
}

/** One line of the terminal section, and when the tools make it true. */
interface TerminalLine {
  when: (has: TerminalTools) => boolean;
  id: PlainPromptId;
}

/** The terminal section's lines, in order; each shows only when its tools are offered. */
const TERMINAL_LINES: readonly TerminalLine[] = [
  {
    when: (has) => has.commands && has.types,
    id: 'sessions/system-driving-a-terminal.prefer-run-command',
  },
  { when: (has) => has.opens, id: 'sessions/system-driving-a-terminal.look-before-you-guess' },
  {
    when: (has) => has.opens && has.reads,
    id: 'sessions/system-driving-a-terminal.open-then-read',
  },
  {
    when: (has) => has.opens && !has.reads && has.types,
    id: 'sessions/system-driving-a-terminal.open-then-wait',
  },
  { when: (has) => !has.opens, id: 'sessions/system-driving-a-terminal.cannot-open' },
  { when: (has) => has.types, id: 'sessions/system-driving-a-terminal.type-a-command' },
  { when: (has) => !has.types && has.reads, id: 'sessions/system-driving-a-terminal.read-only' },
  { when: (has) => has.opens, id: 'sessions/system-driving-a-terminal.one-terminal-per-job' },
  { when: (has) => has.types, id: 'sessions/system-driving-a-terminal.never-type-a-secret' },
  { when: (has) => !has.types, id: 'sessions/system-driving-a-terminal.never-read-a-secret' },
  { when: () => true, id: 'sessions/system-driving-a-terminal.screen-is-outside-text' },
  { when: () => true, id: 'sessions/system-driving-a-terminal.host-must-allow' },
  {
    when: (has) => has.opens || has.types,
    id: 'sessions/system-driving-a-terminal.leave-it-for-the-person',
  },
];
