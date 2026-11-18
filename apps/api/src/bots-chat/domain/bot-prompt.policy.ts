import type { BotApprovalEventStage, BotMessageEvent, BotToolGroup } from '@oppenheimer/shared';
import { approvalAsk } from './bot-approval.policy';
import { eventNote, type HistoryMessage } from './bot-history.policy';
import { peerMessagePrompt, peerReplyPrompt } from './bot-peer-message.policy';
import { type PlainPromptId, promptText } from './bot-prompt-text.policy';
import { pullRequestWakePrompt } from './bot-pull-request-wake.policy';
import { hostCases, recoveryBullets } from './bot-recovery.policy';
import {
  type BotSkillView,
  canFollowSkill,
  skillsPromptSection,
  withBuiltInSkills,
} from './bot-skill.policy';
import { sessionWakePrompt } from './bot-subscription.policy';
import { taskWakePrompt } from './bot-task-wake.policy';
import { TURN_CONTEXT_TAG } from './bot-turn-context.policy';

/** One of our tools the turn offers, as the model will see it. */
export interface BotPromptTool {
  name: string;
  /** The first sentence is what the "What you can do" list shows. */
  description: string;
  /** Its step in a new bot's Getting started list, when it sets the bot up. */
  setupStep?: string;
  /** The area it is listed under, as Settings → Permissions groups it. */
  group?: BotToolGroup;
}

/**
 * What a turn's system prompt is built from: the bot as it is when the turn
 * starts. Nothing here changes from one turn to the next unless the bot
 * does, so the prompt is the same bytes every turn and the provider's
 * prompt cache keeps it; the moment a turn runs in is its message's
 * (`composeTurnContext`).
 */
export interface BotPromptInput {
  name: string;
  description: string;
  soul: string;
  instructions: string;
  /** Its own facts kept in mind (`memoryInMind`), oldest first. */
  facts: readonly string[];
  /** What it keeps in mind about the person, shared by every bot of theirs. */
  personFacts?: readonly string[];
  /**
   * What the person wrote about themselves in Settings → Memory, for every
   * bot of theirs; the bots read it and never change it.
   */
  personAbout?: string;
  /** What the turn's engine does on its own (web search, a to-do list), in words. */
  engineCapabilities: readonly string[];
  /** Our tools offered this turn. */
  tools: readonly BotPromptTool[];
  /**
   * Its own skills; those it may use unasked are listed when the turn offers
   * `use_skill`, with the built-ins the turn's tools can follow (`withBuiltInSkills`,
   * `canFollowSkill`).
   */
  skills?: readonly BotSkillView[];
}

/** What the sections are decided from: the bot, and what the turn's tools allow. */
interface PromptFacts {
  input: BotPromptInput;
  /** The names of the tools the turn offers. */
  offered: readonly string[];
  /** Whether the turn may start a session, run a command, and which terminal tools it has. */
  sessions: boolean;
  commands: boolean;
  terminals: ReadonlySet<string>;
}

/** One section of the prompt: its words, or null when this turn has none for it. */
type PromptSection = (facts: PromptFacts) => string | null;

/**
 * The prompt's sections in the order they are sent: who the bot is, how a
 * turn goes, how it checks what it did, what it can and cannot do (a closed
 * list, so a missing tool is a plain "I can't" rather than a search of the
 * machine it runs on), the rules no instruction overrides, how it works on
 * code through sessions when the turn may start one, its own documents, its
 * skills and memory. A new section is a row; where the row is, is where it
 * is sent. An empty document is left out rather than shown blank.
 */
const SECTIONS: readonly PromptSection[] = [
  ({ input }) => promptText('system/identity.opening', { name: input.name }),
  ({ input }) =>
    written(input.description, (description) =>
      promptText('system/identity.description', { description }),
    ),
  ({ offered }) => howATurnGoes(offered.includes('remember')),
  () => promptText('system/check-before-report'),
  () => promptText('system/turn-context', { tag: TURN_CONTEXT_TAG }),
  ({ input, sessions, commands, terminals }) =>
    whatYouCanDo(input.engineCapabilities, input.tools, sessions, commands, terminals.size > 0),
  () => promptText('system/rules'),
  ({ sessions, commands, terminals }) =>
    sessions ? workingOnCode(commands, terminals.size > 0) : null,
  ({ commands }) => (commands ? promptText('system/commands-on-a-host') : null),
  ({ commands, terminals }) => (terminals.size > 0 ? drivingATerminal(commands, terminals) : null),
  ({ input }) => written(input.soul, (content) => promptText('system/documents.soul', { content })),
  // Its instructions, or, while it has none, how a new bot sets itself up.
  ({ input }) =>
    written(input.instructions, (content) =>
      promptText('system/documents.instructions', { content }),
    ) ?? gettingStarted(input.name, input.tools),
  ({ input, offered }) =>
    skillsPromptSection(
      withBuiltInSkills(input.skills ?? []).filter((skill) => canFollowSkill(skill, offered)),
      { use: offered.includes('use_skill'), save: offered.includes('save_skill') },
    ) || null,
  ({ input }) =>
    written(input.personAbout ?? '', (content) =>
      promptText('system/documents.person-about', { content }),
    ),
  ({ input }) =>
    listed(input.personFacts ?? [], (facts) =>
      promptText('system/documents.general-memory', { facts }),
    ),
  ({ input }) =>
    listed(input.facts, (facts) => promptText('system/documents.own-memory', { facts })),
];

/** What `words` makes of a text someone wrote, trimmed; nothing when they wrote none. */
function written(text: string, words: (text: string) => string): string | null {
  const trimmed = text.trim();
  return trimmed ? words(trimmed) : null;
}

/** What `words` makes of facts as a list, one to a line; nothing when there are none. */
function listed(facts: readonly string[], words: (list: string) => string): string | null {
  return facts.length ? words(facts.map((fact) => `- ${fact}`).join('\n')) : null;
}

/**
 * The bot's system prompt. It is the whole prompt: no engine default comes
 * before it. It is `SECTIONS`, each asked for its words and those with none
 * left out. The facts of the moment (the time, the hosts) are not here: they
 * open the turn's message, in a block the prompt tells the model to trust.
 * The words are prose in `prompts/*.md` (`promptText`); what is here decides
 * which are sent.
 */
export function composeBotSystemPrompt(input: BotPromptInput): string {
  const facts: PromptFacts = {
    input,
    offered: input.tools.map((tool) => tool.name),
    sessions: offersSessions(input.tools),
    commands: offersCommands(input.tools),
    terminals: offeredTerminalTools(input.tools),
  };
  return SECTIONS.flatMap((section) => section(facts) ?? []).join('\n\n');
}

/**
 * A new bot's first chat: while INSTRUCTIONS.md is empty
 * the bot learns its one job and sets itself up for it, rather than waiting
 * for the person to find Settings. The steps between learning the job and
 * reporting back are the `setupStep`s of the tools the turn offers, so a
 * tool the turn lacks adds no step and a new setup tool needs no edit here.
 * From Grok Bot's guide: one focused job per bot, a first concrete task. After
 * the owner's read of the prompt: the welcome greets by the time of day and
 * suggests a name of its own (OpenClaw's BOOTSTRAP.md forbids that; the owner
 * asked for it), a first task is done and ends with one line about the name,
 * job examples stay general until a project is named, and setup reads like
 * Claude Code's `/init`: look first, draft, confirm. Fewer, looser rules than
 * before.
 */
function gettingStarted(name: string, tools: readonly BotPromptTool[]): string {
  const setup = [
    ...projectHint(tools),
    promptText('system/getting-started.look-before-you-ask', { connectOffer: connectOffer(tools) }),
    ...tools.flatMap((tool) => (tool.setupStep ? [tool.setupStep] : [])),
    promptText('system/getting-started.draft-instructions'),
  ];
  const numbered = (steps: readonly string[]) =>
    steps.map((step, i) => `${i + 1}. ${step}`).join('\n');
  return promptText('system/getting-started.body', {
    welcome: numbered(welcomeLines(name, tools)),
    setup: numbered(setup),
  });
}

/**
 * What a new bot tells the person it can do for them, one phrase per area of
 * tools its turn offers, so a person who knows nothing yet hears
 * what Oppenheimer's bots are for and a tool the turn lacks is never promised.
 */
interface AreaIntro {
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
 * Keyed by the tools that act, not by area, so an area the turn can only
 * read (a read-only credential, a tool switched Off) is not promised: an
 * eval of a bot with `list_hosts` alone offered to start coding agents.
 */
const AREA_INTROS: readonly AreaIntro[] = [
  {
    does: 'system/getting-started-areas.hosts-does',
    doneBy: ['start_session', 'start_cloud_session'],
    connects: 'system/getting-started-areas.hosts-connects',
    example: 'system/getting-started-areas.hosts-example',
  },
  { does: 'system/getting-started-areas.commands-does', doneBy: ['run_command'] },
  {
    does: 'system/getting-started-areas.plan-does',
    doneBy: ['create_task', 'update_task'],
    example: 'system/getting-started-areas.plan-example',
  },
  {
    does: 'system/getting-started-areas.gmail-does',
    doneBy: ['send_mail', 'send_draft'],
    connects: 'system/getting-started-areas.gmail-connects',
    example: 'system/getting-started-areas.gmail-example',
  },
  {
    does: 'system/getting-started-areas.whatsapp-does',
    doneBy: ['send_whatsapp_message'],
    connects: 'system/getting-started-areas.whatsapp-connects',
  },
  {
    does: 'system/getting-started-areas.telegram-does',
    doneBy: ['send_telegram_message'],
    connects: 'system/getting-started-areas.telegram-connects',
  },
  {
    does: 'system/getting-started-areas.github-does',
    doneBy: ['review_pull_request', 'comment_on_pull_request', 'create_issue'],
    connects: 'system/getting-started-areas.github-connects',
    example: 'system/getting-started-areas.github-example',
  },
  {
    does: 'system/getting-started-areas.routines-does',
    doneBy: ['update_routine'],
    example: 'system/getting-started-areas.routines-example',
  },
  {
    does: 'system/getting-started-areas.bots-does',
    doneBy: ['message_bot', 'create_bot', 'update_bot'],
  },
  {
    does: 'system/getting-started-areas.web-does',
    doneBy: ['web_fetch'],
    example: 'system/getting-started-areas.web-example',
  },
];

function offeredAreas(tools: readonly BotPromptTool[]): readonly AreaIntro[] {
  const offered = new Set(tools.map((tool) => tool.name));
  return AREA_INTROS.filter((area) => area.doneBy.some((name) => offered.has(name)));
}

/** The most job examples Getting started offers. */
const MAX_JOB_EXAMPLES = 2;

/**
 * The jobs a new bot suggests, from the areas its turn can act in, so a bot
 * without session tools never suggests running coding agents.
 * One that can act nowhere suggests answering questions.
 */
function jobExamples(tools: readonly BotPromptTool[]): string[] {
  const examples = offeredAreas(tools).flatMap((area) =>
    area.example ? [promptText(area.example)] : [],
  );
  return examples.length
    ? examples.slice(0, MAX_JOB_EXAMPLES)
    : [promptText('system/getting-started.answering-questions')];
}

/**
 * The four sentences of a new bot's hello, one line each (2026-11-15): the
 * time of day, a name of its own, what it can help with, the job. Kept as
 * data so the next greeting change is a line here, not an edit inside the
 * Getting started template.
 */
function welcomeLines(name: string, tools: readonly BotPromptTool[]): string[] {
  return [
    promptText('system/getting-started.welcome-greet'),
    promptText('system/getting-started.welcome-name', { name }),
    promptText('system/getting-started.welcome-help', { areas: helpAreas(tools) }),
    promptText('system/getting-started.welcome-ask', { examples: jobExamples(tools).join(' or ') }),
  ];
}

/** What it can help with, in general terms, from the areas its turn can act in. */
function helpAreas(tools: readonly BotPromptTool[]): string {
  const areas = offeredAreas(tools);
  return areas.length
    ? promptText('system/getting-started.help-areas', {
        areas: areas.map((area) => promptText(area.does)).join('; '),
      })
    : promptText('system/getting-started.answering-questions');
}

/**
 * A name or a job that names one of the person's projects says which project
 * the bot is for (2026-11-13): a bot named "Zengue Jewels", after the owner's
 * project, offered only jobs on another project its general memory mentioned.
 */
function projectHint(tools: readonly BotPromptTool[]): string[] {
  if (!tools.some((tool) => tool.name === 'list_projects')) return [];
  return [promptText('system/getting-started.project-hint')];
}

/**
 * The offer to help connect what the job needs, made once a job is picked
 * rather than in the welcome, which it made twice as long (2026-11-13).
 */
function connectOffer(tools: readonly BotPromptTool[]): string {
  const connects = offeredAreas(tools).flatMap((area) =>
    area.connects ? [promptText(area.connects)] : [],
  );
  return connects.length
    ? ` ${promptText('system/getting-started.connect-offer', { services: connects.join(', ') })}`
    : '';
}

/**
 * How a turn goes. With `remember` offered it also says to save as it goes:
 * Grok Bot saves without asking, and a bot told only in the tool's own
 * description saved almost nothing past its first chat.
 */
function howATurnGoes(remembers: boolean): string {
  const body = promptText('system/how-a-turn-goes.body', { recovery: recoveryBullets() });
  return remembers ? `${body}\n${promptText('system/how-a-turn-goes.save-as-you-go')}` : body;
}

/** How the prompt names each area of tools; the order is the list's. */
const TOOL_GROUP_LABELS: Readonly<Record<BotToolGroup, string>> = {
  self: 'Yourself (memory, skills, goals, loops, questions, notices)',
  sessions: 'Hosts and sessions',
  plan: 'Plan and projects',
  github: 'GitHub',
  automations: 'Automations and routines',
  mail: 'Gmail',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  bots: 'Other bots',
  web: 'The web and subagents',
};

/**
 * The closed list of what the bot can do: the engine's own abilities in
 * words, then our tools by name, area by area. The tools' definitions carry
 * what each does, so the list names them rather than repeating them: it was
 * 62% of the prompt when it quoted each tool's first sentence.
 */
function whatYouCanDo(
  engine: readonly string[],
  tools: readonly BotPromptTool[],
  sessions: boolean,
  commands: boolean,
  terminals: boolean,
): string {
  const byGroup = new Map<string, string[]>();
  for (const tool of tools) {
    const label = tool.group ? TOOL_GROUP_LABELS[tool.group] : 'Other';
    byGroup.set(label, [...(byGroup.get(label) ?? []), `\`${tool.name}\``]);
  }
  const order = [...Object.values(TOOL_GROUP_LABELS), 'Other'];
  const lines = [
    ...engine.map((capability) => `- ${capability}`),
    ...order.flatMap((label) => {
      const names = byGroup.get(label);
      return names ? [`- ${label}: ${names.join(', ')}`] : [];
    }),
  ];
  if (lines.length === 0) lines.push(promptText('system/what-you-can-do.answer-only'));
  const reachable = promptText(REACHABLE[`${commands}:${terminals}`]);
  const refusal = promptText('system/what-you-can-do.plain-refusal');
  const closing = sessions
    ? [reachable, promptText('system/what-you-can-do.code-work-goes-to-sessions'), refusal]
    : [reachable, refusal];
  return promptText('system/what-you-can-do.body', {
    lines: lines.join('\n'),
    closing: closing.join(' '),
  });
}

/**
 * Which closing line the closed list ends with, by what the bot can run on a
 * host: `${commands}:${terminals}`.
 */
const REACHABLE: Readonly<Record<`${boolean}:${boolean}`, PlainPromptId>> = {
  'false:false': 'system/what-you-can-do.nothing-else',
  'true:false': 'system/what-you-can-do.nothing-else-but-commands',
  'false:true': 'system/what-you-can-do.nothing-else-but-terminals',
  'true:true': 'system/what-you-can-do.nothing-else-but-commands-and-terminals',
};

/** Which of the terminal tools the turn is offered; empty when none. */
function offeredTerminalTools(tools: readonly BotPromptTool[]): ReadonlySet<string> {
  return new Set(tools.map((tool) => tool.name).filter((name) => TERMINAL_TOOLS.has(name)));
}

/** The terminal tools: any one offered is a terminal to explain. */
const TERMINAL_TOOL_NAMES = ['open_terminal', 'type_in_terminal', 'read_terminal'] as const;
const TERMINAL_TOOLS: ReadonlySet<string> = new Set(TERMINAL_TOOL_NAMES);

/** Whether the turn may run a program on a host (`run_command`). */
function offersCommands(tools: readonly BotPromptTool[]): boolean {
  return tools.some((tool) => tool.name === 'run_command');
}

/** Whether the turn may start a session, so the prompt may promise code work. */
function offersSessions(tools: readonly BotPromptTool[]): boolean {
  return tools.some((tool) => tool.name === 'start_session');
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
        ? 'system/working-on-code.run-command-or-session-with-terminal'
        : 'system/working-on-code.run-command-or-session',
    )}`;
  }
  return terminals ? '' : ` ${promptText('system/working-on-code.never-runs-commands')}`;
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
      ? 'system/working-on-code.delegates-code-work'
      : 'system/working-on-code.delegates-not-a-terminal',
  );
  return promptText('system/working-on-code.body', {
    delegate: `${opening}${delegateTail(commands, terminals)}`,
    hostCases: hostCases(),
  });
}

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
  return promptText('system/driving-a-terminal.body', {
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
  { when: (has) => has.commands && has.types, id: 'system/driving-a-terminal.prefer-run-command' },
  { when: (has) => has.opens, id: 'system/driving-a-terminal.look-before-you-guess' },
  { when: (has) => has.opens && has.reads, id: 'system/driving-a-terminal.open-then-read' },
  {
    when: (has) => has.opens && !has.reads && has.types,
    id: 'system/driving-a-terminal.open-then-wait',
  },
  { when: (has) => !has.opens, id: 'system/driving-a-terminal.cannot-open' },
  { when: (has) => has.types, id: 'system/driving-a-terminal.type-a-command' },
  { when: (has) => !has.types && has.reads, id: 'system/driving-a-terminal.read-only' },
  { when: (has) => has.opens, id: 'system/driving-a-terminal.one-terminal-per-job' },
  { when: (has) => has.types, id: 'system/driving-a-terminal.never-type-a-secret' },
  { when: (has) => !has.types, id: 'system/driving-a-terminal.never-read-a-secret' },
  { when: () => true, id: 'system/driving-a-terminal.screen-is-outside-text' },
  { when: () => true, id: 'system/driving-a-terminal.host-must-allow' },
  {
    when: (has) => has.opens || has.types,
    id: 'system/driving-a-terminal.leave-it-for-the-person',
  },
];

/** What an approval's turn is asked: what came of the card, then what to do about it. */
function approvalPrompt(content: string, stage?: BotApprovalEventStage): string {
  return `${eventNote(content)}\n\n${approvalAsk(stage)}`;
}

/**
 * The prompt of a turn an event opened, one case per kind, so a new kind is
 * a case the compiler asks for. A routine's opening already says what to do
 * (`routineOpening`), and so do a goal's continuation
 * (`goalContinuationText`) and a loop's run (`loopRunText`), so each is read
 * as the note it is.
 */
function eventPrompt(event: BotMessageEvent, content: string): string {
  switch (event.kind) {
    case 'approval':
      return approvalPrompt(content, event.stage);
    case 'question':
      return `${eventNote(content)}\n\n${promptText('wake/question-answered')}`;
    case 'bot_message':
      return peerMessagePrompt(event, content);
    case 'bot_reply':
      return peerReplyPrompt(event, content);
    case 'session':
      return sessionWakePrompt(event, content);
    case 'pull_request':
      return pullRequestWakePrompt(event, content);
    case 'task':
      return taskWakePrompt(event, content);
    case 'routine':
    case 'goal':
    case 'loop':
    case 'dream':
    case 'compaction':
      return eventNote(content);
  }
  // The mapper reads a kind it does not know as no event (`toEvent`), so none gets here.
  throw new Error('An event of no known kind opened a turn');
}

/**
 * What a turn is asked: your message as you wrote it, or, for a turn an event
 * opened, the event with what to do about it (`eventPrompt`). An event
 * this version cannot read is told as an approval's, as it always was.
 */
export function botTurnPrompt(opening: HistoryMessage | null): string {
  if (!opening) return '';
  if (opening.role !== 'event') return opening.content;
  const event = opening.event;
  return event ? eventPrompt(event, opening.content) : approvalPrompt(opening.content);
}
