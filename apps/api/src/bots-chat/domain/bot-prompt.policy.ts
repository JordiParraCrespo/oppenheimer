import type { BotApprovalEventStage, BotMessageEvent, BotToolGroup } from '@oppenheimer/shared';
import { approvalAsk } from './bot-approval.policy';
import {
  type AreaIntro,
  BOT_CAPABILITIES,
  type CapabilityFacts,
  TERMINAL_TOOL_NAMES,
} from './bot-capability.policy';
import { checkBackPrompt } from './bot-check-back.policy';
import { githubAskPrompt } from './bot-github-ask.policy';
import { eventNote, type HistoryMessage } from './bot-history.policy';
import { peerMessagePrompt, peerReplyPrompt } from './bot-peer-message.policy';
import { type PlainPromptId, promptText } from './bot-prompt-text.policy';
import { pullRequestWakePrompt } from './bot-pull-request-wake.policy';
import { recoveryBullets } from './bot-recovery.policy';
import { canFollowSkill, skillsPromptSection, withBuiltInSkills } from './bot-skill.policy';
import type { BotSkillView } from './bot-skill.types';
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
interface PromptFacts extends CapabilityFacts {
  input: BotPromptInput;
}

/** One section of the prompt: its words, or null when this turn has none for it. */
type PromptSection = (facts: PromptFacts) => string | null;

/**
 * The prompt's sections in the order they are sent: who the bot is, how a
 * turn goes, how it checks what it did, what it can and cannot do (a closed
 * list, so a missing tool is a plain "I can't" rather than a search of the
 * machine it runs on), the rules no instruction overrides, what holds for
 * each capability the turn can use (`BOT_CAPABILITIES`), its own documents,
 * its skills and memory. A new section is a row; where the row is, is where it
 * is sent. An empty document is left out rather than shown blank.
 */
const SECTIONS: readonly PromptSection[] = [
  ({ input }) => promptText('core/system-identity.opening', { name: input.name }),
  ({ input }) =>
    written(input.description, (description) =>
      promptText('core/system-identity.description', { description }),
    ),
  ({ offered }) => howATurnGoes(offered.includes('remember')),
  () => promptText('core/system-check-before-report'),
  () => promptText('core/system-turn-context', { tag: TURN_CONTEXT_TAG }),
  ({ input, sessions, commands, terminals }) =>
    whatYouCanDo(input.engineCapabilities, input.tools, sessions, commands, terminals.size > 0),
  () => promptText('core/system-rules'),
  // What holds on every turn for each capability the turn can use, in the list's order.
  ...BOT_CAPABILITIES.flatMap((capability) => capability.sections),
  ({ offered }) => (offered.includes('use_skill') ? null : inlineCapabilitySkills(offered)),
  ({ input }) =>
    written(input.soul, (content) => promptText('core/system-documents.soul', { content })),
  // Its instructions, or, while it has none, how a new bot sets itself up.
  ({ input }) =>
    written(input.instructions, (content) =>
      promptText('core/system-documents.instructions', { content }),
    ) ?? gettingStarted(input.name, input.tools),
  ({ input, offered }) =>
    skillsPromptSection(
      withBuiltInSkills(input.skills ?? []).filter((skill) => canFollowSkill(skill, offered)),
      { use: offered.includes('use_skill'), save: offered.includes('save_skill') },
    ) || null,
  ({ input }) =>
    written(input.personAbout ?? '', (content) =>
      promptText('core/system-documents.person-about', { content }),
    ),
  ({ input }) =>
    listed(input.personFacts ?? [], (facts) =>
      promptText('core/system-documents.general-memory', { facts }),
    ),
  ({ input }) =>
    listed(input.facts, (facts) => promptText('core/system-documents.own-memory', { facts })),
];

/**
 * The capabilities' skills this turn could follow, in full, for a turn that
 * cannot read skills (the owner turned `use_skill` Off): their how-to was a
 * section of the prompt until 2026-11-23, and a bot that cannot read it
 * would lose it.
 */
function inlineCapabilitySkills(offered: readonly string[]): string | null {
  const skills = BOT_CAPABILITIES.flatMap((capability) => capability.skills).filter((skill) =>
    canFollowSkill(skill, offered),
  );
  if (skills.length === 0) return null;
  return skills
    .map((skill) => promptText('skills/system.inline', { name: skill.name, body: skill.body }))
    .join('\n\n');
}

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
    promptText('core/system-getting-started.look-before-you-ask', {
      connectOffer: connectOffer(tools),
    }),
    ...tools.flatMap((tool) => (tool.setupStep ? [tool.setupStep] : [])),
    promptText('core/system-getting-started.draft-instructions'),
  ];
  const numbered = (steps: readonly string[]) =>
    steps.map((step, i) => `${i + 1}. ${step}`).join('\n');
  return promptText('core/system-getting-started.body', {
    welcome: numbered(welcomeLines(name, tools)),
    setup: numbered(setup),
  });
}

/**
 * What a new bot tells the person it can do for them, one phrase per area of
 * tools its turn offers, so a person who knows nothing yet hears
 * what Oppenheimer's bots are for and a tool the turn lacks is never promised.
 * Keyed by the tools that act, not by area, so an area the turn can only
 * read (a read-only credential, a tool switched Off) is not promised: an
 * eval of a bot with `list_hosts` alone offered to start coding agents.
 */
const AREA_INTROS: readonly AreaIntro[] = BOT_CAPABILITIES.flatMap(
  (capability) => capability.intros,
);

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
    : [promptText('core/system-getting-started.answering-questions')];
}

/**
 * The four sentences of a new bot's hello, one line each (2026-11-15): the
 * time of day, a name of its own, what it can help with, the job. Kept as
 * data so the next greeting change is a line here, not an edit inside the
 * Getting started template.
 */
function welcomeLines(name: string, tools: readonly BotPromptTool[]): string[] {
  return [
    promptText('core/system-getting-started.welcome-greet'),
    promptText('core/system-getting-started.welcome-name', { name }),
    promptText('core/system-getting-started.welcome-help', { areas: helpAreas(tools) }),
    promptText('core/system-getting-started.welcome-ask', {
      examples: jobExamples(tools).join(' or '),
    }),
  ];
}

/** What it can help with, in general terms, from the areas its turn can act in. */
function helpAreas(tools: readonly BotPromptTool[]): string {
  const areas = offeredAreas(tools);
  return areas.length
    ? promptText('core/system-getting-started.help-areas', {
        areas: areas.map((area) => promptText(area.does)).join('; '),
      })
    : promptText('core/system-getting-started.answering-questions');
}

/**
 * A name or a job that names one of the person's projects says which project
 * the bot is for (2026-11-13): a bot named "Zengue Jewels", after the owner's
 * project, offered only jobs on another project its general memory mentioned.
 */
function projectHint(tools: readonly BotPromptTool[]): string[] {
  if (!tools.some((tool) => tool.name === 'list_projects')) return [];
  return [promptText('core/system-getting-started.project-hint')];
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
    ? ` ${promptText('core/system-getting-started.connect-offer', { services: connects.join(', ') })}`
    : '';
}

/**
 * How a turn goes. With `remember` offered it also says to save as it goes:
 * Grok Bot saves without asking, and a bot told only in the tool's own
 * description saved almost nothing past its first chat.
 */
function howATurnGoes(remembers: boolean): string {
  const body = promptText('core/system-how-a-turn-goes.body', { recovery: recoveryBullets() });
  return remembers ? `${body}\n${promptText('core/system-how-a-turn-goes.save-as-you-go')}` : body;
}

/** How the prompt names each area of tools: the bot's own, then each capability's, in the list's order. */
const TOOL_GROUP_LABELS: ReadonlyMap<BotToolGroup, string> = new Map([
  ['self', 'Yourself (memory, skills, goals, loops, questions, notices)'],
  ...BOT_CAPABILITIES.flatMap((capability) =>
    capability.lists ? [[capability.lists.group, capability.lists.label] as const] : [],
  ),
]);

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
    const label = (tool.group && TOOL_GROUP_LABELS.get(tool.group)) || 'Other';
    byGroup.set(label, [...(byGroup.get(label) ?? []), `\`${tool.name}\``]);
  }
  const order = [...TOOL_GROUP_LABELS.values(), 'Other'];
  const lines = [
    ...engine.map((capability) => `- ${capability}`),
    ...order.flatMap((label) => {
      const names = byGroup.get(label);
      return names ? [`- ${label}: ${names.join(', ')}`] : [];
    }),
  ];
  if (lines.length === 0) lines.push(promptText('core/system-what-you-can-do.answer-only'));
  const reachable = [
    promptText(REACHABLE[`${commands}:${terminals}`]),
    ...(offersTool(tools, 'use_computer')
      ? [promptText('core/system-what-you-can-do.and-a-screen')]
      : []),
    ...(offersTool(tools, 'use_browser')
      ? [promptText('core/system-what-you-can-do.and-a-browser')]
      : []),
  ].join(' ');
  const refusal = promptText('core/system-what-you-can-do.plain-refusal');
  const closing = sessions
    ? [reachable, promptText('core/system-what-you-can-do.code-work-goes-to-sessions'), refusal]
    : [reachable, refusal];
  return promptText('core/system-what-you-can-do.body', {
    lines: lines.join('\n'),
    closing: closing.join(' '),
  });
}

/**
 * Which closing line the closed list ends with, by what the bot can run on a
 * host: `${commands}:${terminals}`.
 */
const REACHABLE: Readonly<Record<`${boolean}:${boolean}`, PlainPromptId>> = {
  'false:false': 'core/system-what-you-can-do.nothing-else',
  'true:false': 'core/system-what-you-can-do.nothing-else-but-commands',
  'false:true': 'core/system-what-you-can-do.nothing-else-but-terminals',
  'true:true': 'core/system-what-you-can-do.nothing-else-but-commands-and-terminals',
};

/** Whether the turn offers the tool `name`. */
function offersTool(tools: readonly BotPromptTool[], name: string): boolean {
  return tools.some((tool) => tool.name === name);
}

/** Which of the terminal tools the turn is offered; empty when none. */
function offeredTerminalTools(tools: readonly BotPromptTool[]): ReadonlySet<string> {
  return new Set(tools.map((tool) => tool.name).filter((name) => TERMINAL_TOOLS.has(name)));
}

const TERMINAL_TOOLS: ReadonlySet<string> = new Set(TERMINAL_TOOL_NAMES);

/** Whether the turn may run a program on a host (`run_command`). */
function offersCommands(tools: readonly BotPromptTool[]): boolean {
  return tools.some((tool) => tool.name === 'run_command');
}

/** Whether the turn may start a session, so the prompt may promise code work. */
function offersSessions(tools: readonly BotPromptTool[]): boolean {
  return tools.some((tool) => tool.name === 'start_session');
}

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
    case 'form':
      return `${eventNote(content)}\n\n${promptText('core/wake-question-answered')}`;
    case 'bot_message':
      return peerMessagePrompt(event, content);
    case 'bot_reply':
      return peerReplyPrompt(event, content);
    case 'session':
      return sessionWakePrompt(event, content);
    case 'pull_request':
      return pullRequestWakePrompt(event, content);
    case 'github_ask':
      return githubAskPrompt(content);
    case 'task':
      return taskWakePrompt(event, content);
    case 'check_back':
      return checkBackPrompt(content);
    case 'routine':
    case 'goal':
    case 'loop':
    case 'dream':
    case 'compaction':
      return eventNote(content);
    // The mapper reads a kind it does not know as no event (`toEvent`), so none
    // gets here; `never` is what makes a new kind a case the compiler asks for.
    default:
      throw new Error(
        `An event of no known kind opened a turn: ${String((event satisfies never as { kind?: unknown }).kind)}`,
      );
  }
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
