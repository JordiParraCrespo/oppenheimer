import { z } from 'zod';
import {
  CODING_AGENTS,
  type CodingAgentEffort,
  SESSION_EFFORTS,
  type SessionEffort,
  type SessionPermission,
} from '../agents/catalog.js';
import { GROK_4_5_LEVELS, GROK_LEVELS, levels } from '../agents/effort-levels.js';
import { isValidTimeZone } from '../automations/schedule.js';

/**
 * Bot shapes (`product/versions/mvp/25-bots.md`, slice 1): a bot, the sidebar
 * groups it sits in, its two documents with their revisions, and the facts it
 * remembers. The constraints decidable from the body alone are here; whether a
 * group, a host or a model exists for the caller is the API's to answer.
 */

/**
 * The eight colours an avatar is drawn on (the design's `AV_COLORS`), by key:
 * an avatar is the bot's initials on one of them, never a photograph.
 */
export const BOT_AVATAR_COLORS = [
  'mint',
  'tangerine',
  'snow',
  'sky',
  'lilac',
  'lemon',
  'coral',
  'moss',
] as const;
export type BotAvatarColor = (typeof BOT_AVATAR_COLORS)[number];

/** What a bot is (`SOUL.md`) and what its job is (`INSTRUCTIONS.md`). */
export const BOT_DOCUMENT_NAMES = ['soul', 'instructions'] as const;
export type BotDocumentName = (typeof BOT_DOCUMENT_NAMES)[number];

/**
 * How far a bot's turns may go without asking. `ask` arrives with approvals
 * (slice 4): a headless turn with no prompt tool would refuse every tool.
 */
export const BOT_PERMISSIONS = ['auto', 'full'] as const satisfies readonly SessionPermission[];
export type BotPermission = (typeof BOT_PERMISSIONS)[number];

/**
 * The console sections a bot shows in, beside Employees
 * (`product/versions/mvp/28-bots-in-sections.md`): each section's sidebar lists
 * the bots that name it under a Bots heading. A bot names none until its
 * owner, or the section's plus that made it, puts it there.
 */
export const BOT_SECTIONS = ['sessions', 'automations', 'plan', 'pulls'] as const;
export type BotSection = (typeof BOT_SECTIONS)[number];

/** Who wrote a document revision or a memory fact: a person, or the bot through its tools. */
export const BOT_AUTHORS = ['user', 'bot'] as const;
export type BotAuthor = (typeof BOT_AUTHORS)[number];

export const BOT_NAME_MAX = 80;
export const BOT_DESCRIPTION_MAX = 280;
export const BOT_GROUP_NAME_MAX = 60;
/** A document's length in characters; 32 Ki is far past a page of instructions. */
export const BOT_DOCUMENT_MAX = 32_768;
export const BOT_REVISION_NOTE_MAX = 200;
export const BOT_MEMORY_FACT_MAX = 500;
/** How many facts one bot may keep, both tiers together. */
export const BOT_MEMORY_FACTS_MAX = 200;

/**
 * How a fact is kept (`25-bots.md` §4.1; from Grok Bot's memory tiers,
 * `research/lessons-from-grok-bot.md` §9 row 11): `profile`, in mind in
 * every turn (who the person is, standing preferences); `log`, kept to be
 * looked up with `recall` (a detail, a past decision), never in the prompt.
 */
export const BOT_MEMORY_TIERS = ['profile', 'log'] as const;
export type BotMemoryTier = (typeof BOT_MEMORY_TIERS)[number];

/**
 * Who a fact is for: this bot alone (`bot`), or the person, so every bot of
 * theirs in the workspace keeps it in mind too (`person`).
 */
export const BOT_MEMORY_SCOPES = ['bot', 'person'] as const;
export type BotMemoryScope = (typeof BOT_MEMORY_SCOPES)[number];

/** The `profile` facts one turn is given, newest first: the rest wait for `recall`. */
export const BOT_MEMORY_PROFILE_IN_PROMPT_MAX = 60;
/** The most revisions one read returns, newest first. */
export const BOT_REVISIONS_PAGE_MAX = 100;
export const BOT_REVISIONS_PAGE_DEFAULT = 50;

/**
 * A new bot's `SOUL.md`, the design's template with `{name}` replaced by the
 * bot's name. Its `INSTRUCTIONS.md` starts empty: in its first chat the bot
 * asks for its job and writes them itself.
 */
export const BOT_SOUL_TEMPLATE =
  '# Soul\n\nYou are {name}. You speak like a calm colleague: short sentences, numbers over adjectives, no exclamation marks.\n\nYou never pretend a step finished when it did not.\n';

export function botSoulFor(name: string): string {
  return BOT_SOUL_TEMPLATE.replace('{name}', name);
}

/**
 * Who answers a bot (`product/versions/mvp/25-bots.md` §2): the provider picks
 * the engine, Anthropic and GLM the Claude Agent SDK, OpenAI, ChatGPT and xAI
 * the OpenAI Agents SDK. Each runs on the workspace's own key for it; ChatGPT's
 * is a sign-in to a ChatGPT subscription rather than an API key.
 */
export const BOT_PROVIDERS = ['anthropic', 'glm', 'openai', 'chatgpt', 'xai'] as const;
export type BotProvider = (typeof BOT_PROVIDERS)[number];

/**
 * The order a bot falls back through when its provider has no key, or a new
 * bot names none: Anthropic, then ChatGPT and OpenAI, then xAI, GLM last. It
 * is not the catalog order, which is how the model button lists them.
 */
export const BOT_PROVIDER_PREFERENCE: readonly BotProvider[] = Object.freeze([
  'anthropic',
  'chatgpt',
  'openai',
  'xai',
  'glm',
]);

/** The first provider in `BOT_PROVIDER_PREFERENCE` that has a key; undefined when none does. */
export function preferredKeyedProvider(keyed: readonly BotProvider[]): BotProvider | undefined {
  return BOT_PROVIDER_PREFERENCE.find((provider) => keyed.includes(provider));
}

/** One model a bot may run on, as the composer's model chip lists it. */
export interface BotModel {
  readonly id: string;
  readonly label: string;
  readonly default?: true;
  readonly effort?: CodingAgentEffort;
}

/**
 * How a workspace gives a provider its credential: an API key typed once, or a
 * sign-in to the provider's own account (ChatGPT's device code).
 */
export type BotProviderAuth = 'api_key' | 'sign_in';

export interface BotProviderDefinition {
  readonly id: BotProvider;
  readonly label: string;
  readonly auth: BotProviderAuth;
  /**
   * Whether the provider's models read images: a message may carry
   * attachments only to a bot on one that does (`25-bots.md` §3.1).
   */
  readonly images: boolean;
  readonly models: readonly BotModel[];
}

const GLM_LEVELS = Object.freeze({
  levels: Object.freeze(['low', 'medium', 'high'] as SessionEffort[]),
  default: 'medium' as SessionEffort,
});

/**
 * What xAI's Responses API takes as `reasoning.effort`: Grok's own menus, the
 * ones its CLI offers a session, defaulting to `high` as xAI does (an `xhigh`
 * sent to 4.5 is read as `high`). Grok Build 0.1 refuses the parameter, so its
 * row offers none.
 */
const GROK_EFFORT = levels(GROK_LEVELS, 'high');
const GROK_4_5_EFFORT = levels(GROK_4_5_LEVELS, 'high');

/**
 * The models each provider offers a bot. Anthropic's and OpenAI's are the rows
 * the coding agents already list (Claude Code's, Codex's), so a model offered to
 * a session and to a bot is one row; GLM's are z.ai's, reached through its
 * Anthropic-compatible endpoint; xAI's are Grok's, through its Responses API.
 */
export const BOT_PROVIDER_CATALOG: Readonly<Record<BotProvider, BotProviderDefinition>> =
  Object.freeze({
    anthropic: Object.freeze({
      id: 'anthropic',
      images: true,
      auth: 'api_key',
      label: 'Anthropic',
      models: CODING_AGENTS['claude-code'].models,
    }),
    glm: Object.freeze({
      id: 'glm',
      images: false,
      auth: 'api_key',
      label: 'GLM',
      models: Object.freeze([
        Object.freeze({
          id: 'glm-5.3',
          label: 'GLM-5.3',
          default: true as const,
          effort: GLM_LEVELS,
        }),
      ]),
    }),
    openai: Object.freeze({
      id: 'openai',
      images: true,
      auth: 'api_key',
      label: 'OpenAI',
      models: CODING_AGENTS.codex.models,
    }),
    chatgpt: Object.freeze({
      id: 'chatgpt',
      images: true,
      auth: 'sign_in',
      label: 'ChatGPT',
      models: CODING_AGENTS.codex.models,
    }),
    xai: Object.freeze({
      id: 'xai',
      images: true,
      auth: 'api_key',
      label: 'Grok',
      models: Object.freeze([
        Object.freeze({
          id: 'grok-4.7',
          label: 'Grok 4.7',
          default: true as const,
          effort: GROK_EFFORT,
        }),
        Object.freeze({ id: 'grok-4.6', label: 'Grok 4.6', effort: GROK_EFFORT }),
        Object.freeze({ id: 'grok-4.5', label: 'Grok 4.5', effort: GROK_4_5_EFFORT }),
        Object.freeze({ id: 'grok-build-0.1', label: 'Grok Build 0.1' }),
      ]),
    }),
  });

/** Whether a bot on `provider` can be sent images. */
export function botTakesImages(provider: BotProvider): boolean {
  return BOT_PROVIDER_CATALOG[provider].images;
}

/** The model a bot on `provider` runs when it names none: the provider's default row. */
export function botDefaultModel(provider: BotProvider): BotModel {
  const { models } = BOT_PROVIDER_CATALOG[provider];
  return models.find((row) => row.default) ?? models[0];
}

/** The catalog row for `model` on `provider`; `null` is the provider's default. */
export function botModelOf(provider: BotProvider, model: string | null): BotModel | undefined {
  if (model === null) return botDefaultModel(provider);
  return BOT_PROVIDER_CATALOG[provider].models.find((row) => row.id === model);
}

/**
 * The effort a bot on `provider` and `model` records for `requested`: the level
 * when that model offers it, else none (the model's own default).
 */
export function botEffortLevelFor(
  provider: BotProvider,
  model: string | null,
  requested: unknown,
): SessionEffort | null {
  if (!SESSION_EFFORTS.includes(requested as SessionEffort)) return null;
  const level = requested as SessionEffort;
  return botModelOf(provider, model)?.effort?.levels.includes(level) ? level : null;
}

/** A provider key's length bounds: wide enough for every provider's format. */
export const BOT_PROVIDER_KEY_MIN = 8;
export const BOT_PROVIDER_KEY_MAX = 512;

export const botProviderSchema = z.enum(BOT_PROVIDERS);

/** `PUT /model-providers/:provider`: the key, replacing the one stored. Never read back. */
export const putModelProviderCredentialSchema = z.object({
  apiKey: z.string().trim().min(BOT_PROVIDER_KEY_MIN).max(BOT_PROVIDER_KEY_MAX),
});
export type PutModelProviderCredentialDto = z.infer<typeof putModelProviderCredentialSchema>;

/** A ChatGPT sign-in in progress, as the API hands it out: opaque, sealed, a few KB at most. */
export const CHATGPT_LOGIN_FLOW_MAX = 4096;

/** `POST /model-providers/chatgpt/login/poll`: the sign-in the console is waiting on. */
export const pollChatgptLoginSchema = z.object({
  flowId: z.string().min(1).max(CHATGPT_LOGIN_FLOW_MAX),
});
export type PollChatgptLoginDto = z.infer<typeof pollChatgptLoginSchema>;

/** Where a ChatGPT sign-in stands: still waiting for the person, or stored. */
export const CHATGPT_LOGIN_STATUSES = ['pending', 'connected'] as const;
export type ChatgptLoginStatus = (typeof CHATGPT_LOGIN_STATUSES)[number];

export const botAvatarColorSchema = z.enum(BOT_AVATAR_COLORS);
export const botDocumentNameSchema = z.enum(BOT_DOCUMENT_NAMES);
export const botPermissionSchema = z.enum(BOT_PERMISSIONS);
export const botSectionSchema = z.enum(BOT_SECTIONS);
/** A set of sections: each at most once, in any order. */
const botSectionsSchema = z
  .array(botSectionSchema)
  .max(BOT_SECTIONS.length)
  .refine((sections) => new Set(sections).size === sections.length, 'A section is named once');

const botNameSchema = z.string().trim().min(1).max(BOT_NAME_MAX);
const botDescriptionSchema = z.string().trim().max(BOT_DESCRIPTION_MAX);
const botGroupNameSchema = z.string().trim().min(1).max(BOT_GROUP_NAME_MAX);
const memoryFactContentSchema = z.string().trim().min(1).max(BOT_MEMORY_FACT_MAX);
const positionSchema = z.number().int().min(0).max(10_000);

/**
 * `POST /bots`. Everything is optional: a blank bot takes the next first
 * name the workspace does not have ("Juno", "Milo"…), on the next avatar colour, ungrouped, with no
 * home host until one is chosen.
 */
export const createBotSchema = z.object({
  name: botNameSchema.optional(),
  description: botDescriptionSchema.optional(),
  avatarColor: botAvatarColorSchema.optional(),
  groupId: z.string().uuid().nullable().optional(),
  homeHostId: z.string().uuid().nullable().optional(),
  /**
   * Unless named, the workspace's default provider (Settings → Model providers),
   * else the one it stored a key for first, else Anthropic. The model is then
   * the provider's default.
   */
  provider: botProviderSchema.optional(),
  /** The sections it shows in; none unless named (a section's plus names its own). */
  sections: botSectionsSchema.optional(),
});
export type CreateBotDto = z.infer<typeof createBotSchema>;

/**
 * `PATCH /bots/:id`. A field left out is unchanged; `null` clears what can be
 * cleared. A `position` places the bot at that index inside its group (the new
 * one when `groupId` moves it), and the others close up around it; a move with
 * no position puts it last.
 */
export const updateBotSchema = z.object({
  name: botNameSchema.optional(),
  description: botDescriptionSchema.optional(),
  avatarColor: botAvatarColorSchema.optional(),
  groupId: z.string().uuid().nullable().optional(),
  position: positionSchema.optional(),
  homeHostId: z.string().uuid().nullable().optional(),
  /** Who answers the bot. A change of provider resets the model to that provider's default. */
  provider: botProviderSchema.optional(),
  /** A model id the provider's catalog lists; `null` is the provider's default. */
  model: z.string().min(1).max(128).nullable().optional(),
  /** Recorded only when the model offers it; otherwise the CLI's own default. */
  effort: z.enum(SESSION_EFFORTS).nullable().optional(),
  permission: botPermissionSchema.optional(),
  learnAutomatically: z.boolean().optional(),
  /** The whole set of sections it shows in; `[]` shows it in Employees only. */
  sections: botSectionsSchema.optional(),
});
export type UpdateBotDto = z.infer<typeof updateBotSchema>;

/** `POST /bot-groups`. A new group goes last in the sidebar. */
export const createBotGroupSchema = z.object({
  name: botGroupNameSchema,
});
export type CreateBotGroupDto = z.infer<typeof createBotGroupSchema>;

/** `PATCH /bot-groups/:id`. A position places the group at that index; the rest close up. */
export const updateBotGroupSchema = z.object({
  name: botGroupNameSchema.optional(),
  position: positionSchema.optional(),
});
export type UpdateBotGroupDto = z.infer<typeof updateBotGroupSchema>;

/**
 * `PUT /bots/:id/documents/:name`. `baseRevision` is the revision the editor
 * loaded: a save over a newer one is refused rather than silently winning.
 */
export const updateBotDocumentSchema = z.object({
  content: z.string().max(BOT_DOCUMENT_MAX),
  baseRevision: z.number().int().min(1),
  note: z.string().trim().max(BOT_REVISION_NOTE_MAX).optional(),
});
export type UpdateBotDocumentDto = z.infer<typeof updateBotDocumentSchema>;

/** `GET /bots/:id/documents/:name/revisions`: newest first, at most `limit`. */
export const findBotDocumentRevisionsSchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(BOT_REVISIONS_PAGE_MAX)
    .default(BOT_REVISIONS_PAGE_DEFAULT),
});
export type FindBotDocumentRevisionsDto = z.infer<typeof findBotDocumentRevisionsSchema>;

/** `POST /bots/:id/memory`: one fact, in a sentence, kept in mind for this bot unless said. */
export const botMemoryFactSchema = z.object({
  content: memoryFactContentSchema,
  tier: z.enum(BOT_MEMORY_TIERS).optional(),
  scope: z.enum(BOT_MEMORY_SCOPES).optional(),
});
export type BotMemoryFactDto = z.infer<typeof botMemoryFactSchema>;

/** `PATCH /bots/:id/memory/:factId`: its words, its tier or its scope, at least one. */
export const updateBotMemoryFactSchema = z
  .object({
    content: memoryFactContentSchema.optional(),
    tier: z.enum(BOT_MEMORY_TIERS).optional(),
    scope: z.enum(BOT_MEMORY_SCOPES).optional(),
  })
  .refine(
    (change) =>
      change.content !== undefined || change.tier !== undefined || change.scope !== undefined,
    { params: { i18nKey: 'validation.required' } },
  );
export type UpdateBotMemoryFactDto = z.infer<typeof updateBotMemoryFactSchema>;

/**
 * A bot's turn (`product/versions/mvp/25-bots.md` §2): one message of yours
 * and what the bot did with it. `queued` waits for the bot's turn before it;
 * one turn per bot runs at a time.
 */
export const BOT_TURN_STATUSES = ['queued', 'running', 'completed', 'cancelled', 'failed'] as const;
export type BotTurnStatus = (typeof BOT_TURN_STATUSES)[number];

/**
 * Why a failed turn failed, as a kind the chat can act on (`25-bots.md` §2):
 * whether sending it again can help, and what to do instead when it cannot.
 * From Grok Bot's failure lines (`research/lessons-from-grok-bot.md` §9,
 * row 4). The words of the failure stay in the turn's `error`.
 *
 * - `rate_limit`: the provider said "not now"; it passes.
 * - `usage_limit`: the account's quota or credit is spent; it passes when the
 *   plan resets or is topped up, not on a retry.
 * - `credential`: the key or sign-in was refused; fixed in Settings.
 * - `refused`: the provider refused this request (its content, the model);
 *   the same request fails the same way.
 * - `unavailable`: the provider was down, overloaded or unreachable; it passes.
 * - `time_limit`: the turn ran past its time; a smaller step fits.
 * - `interrupted`: the worker running it stopped; sending it again runs it.
 * - `other`: none of these, or not known.
 */
export const BOT_TURN_FAILURES = [
  'rate_limit',
  'usage_limit',
  'credential',
  'refused',
  'unavailable',
  'time_limit',
  'interrupted',
  'other',
] as const;
export type BotTurnFailure = (typeof BOT_TURN_FAILURES)[number];

/** Whether sending the same message again can succeed, for each kind of failure. */
export const BOT_TURN_FAILURE_RETRIES: Readonly<Record<BotTurnFailure, boolean>> = {
  rate_limit: true,
  usage_limit: false,
  credential: false,
  refused: false,
  unavailable: true,
  time_limit: false,
  interrupted: true,
  other: true,
};

/**
 * Which of a bot's waiting turns runs first (`25-bots.md` §4.6,
 * `BotQueueLanes`): yours, then what other bots sent it, then work nobody
 * waits on. Within a lane, the oldest first.
 */
export const BOT_TURN_LANES = ['owner', 'bots', 'background'] as const;
export type BotTurnLane = (typeof BOT_TURN_LANES)[number];

/** A turn that has not ended: the chat shows it as working, and Stop applies to it. */
export const BOT_ACTIVE_TURN_STATUSES = [
  'queued',
  'running',
] as const satisfies readonly BotTurnStatus[];

/**
 * What the chat draws (§3): your message, the bot's text, one activity line
 * per run of tool calls, and an `event`: something Oppenheimer tells the bot
 * on the person's behalf (an approval decided, and what the approved call
 * answered). An event opens the turn it starts, like a message of yours, but
 * the chat draws it as a small line, not as a message from you, and the bot
 * reads it back as a note from Oppenheimer.
 */
export const BOT_MESSAGE_ROLES = ['user', 'assistant', 'activity', 'event'] as const;
export type BotMessageRole = (typeof BOT_MESSAGE_ROLES)[number];

/**
 * What an `event` message says happened, for the chat to draw without
 * reading its words: an approval decided (`25-bots.md` §5), how it went,
 * and the card's line; a routine that changed, ran or failed
 * (`26-bot-routines.md` §4); a message from another bot, or its answer
 * (`25-bots.md` §4.6); or a session the bot follows that needs it
 * (`27-bot-subscriptions.md`). The words stay in the message for the bot.
 */
export const BOT_EVENT_OUTCOMES = ['approved', 'denied', 'stopped', 'failed'] as const;
export type BotEventOutcome = (typeof BOT_EVENT_OUTCOMES)[number];

export interface BotApprovalEvent {
  kind: 'approval';
  outcome: BotEventOutcome;
  /** The approved or denied call's tool. */
  tool: string;
  /** The card's line: what the call does, in words. */
  summary: string;
  /** The session the approved call started, for the chat to link to; null when it started none. */
  sessionId: string | null;
  /**
   * The card it decided, so a chat that drew the decision early (from the
   * stream's `approval_resolved`) knows the stored line is the same one.
   * Absent on lines written before it was kept.
   */
  approvalId?: string;
}

/** How a card of questions was decided: answered, or dismissed. */
export const BOT_QUESTION_OUTCOMES = ['answered', 'dismissed'] as const;
export type BotQuestionOutcome = (typeof BOT_QUESTION_OUTCOMES)[number];

/** A card of questions decided (`ask_user`, `25-bots.md` §3.2): how, its line, and each answer. */
export interface BotQuestionEvent {
  kind: 'question';
  outcome: BotQuestionOutcome;
  /** The card's line: its first question, and how many follow. */
  summary: string;
  /** Each question and its answer in words; empty when dismissed. */
  answers: BotAnsweredQuestion[];
}

/** One answered question of an `ask_user` card, as the chat shows it. */
export interface BotAnsweredQuestion {
  question: string;
  /** The picked options' labels and the person's own words, joined. */
  answer: string;
}

/**
 * What happened to a routine, as one activity whatever path made it
 * (`26-bot-routines.md` §4, "In the chat"): a change, a run, or a failure.
 */
export const BOT_ROUTINE_ACTIVITIES = [
  'saved',
  'changed',
  'paused',
  'resumed',
  'deleted',
  'ran',
  'failed',
] as const;
export type BotRoutineActivity = (typeof BOT_ROUTINE_ACTIVITIES)[number];

export interface BotRoutineEvent {
  kind: 'routine';
  activity: BotRoutineActivity;
  /** The routine: an automation whose run target is the bot. */
  automationId: string;
  /** The run, for an activity that has one (`ran`, `failed`). */
  runId: string | null;
  /** The routine's name at the time. */
  name: string;
  /** Why, as a code, for `paused` (its paused reason) and `failed` (a skip reason, or `expired`). */
  reason: string | null;
}

/**
 * A session a bot is subscribed to woke it (`27-bot-subscriptions.md` §4):
 * the task it delegated needs input, ended, failed, was stopped or expired.
 * The ids and names are Oppenheimer's record, never the session's words.
 */
export const BOT_SESSION_WAKE_STATES = [
  'requires_action',
  'completed',
  'failed',
  'cancelled',
  'expired',
] as const;
export type BotSessionWakeState = (typeof BOT_SESSION_WAKE_STATES)[number];

/**
 * What a session event says: a task's wake state; `matched`, its terminal
 * printed a line matching a watch's pattern; or `stalled`, the silent stall
 * check found the task stuck before it reached any wake state
 * (`27-bot-subscriptions.md` §4.1).
 */
export const BOT_SESSION_EVENT_STATES = [...BOT_SESSION_WAKE_STATES, 'matched', 'stalled'] as const;
export type BotSessionEventState = (typeof BOT_SESSION_EVENT_STATES)[number];

export interface BotSessionEvent {
  kind: 'session';
  /** The subscription that woke the bot. */
  subscriptionId: string;
  sessionId: string;
  /** The session's name at the wake. */
  sessionName: string;
  /** Which of the session's tasks (its turn's number). */
  turn: number;
  /** What became of the task; `matched`, its terminal printed what the bot watches for; or `stalled`. */
  state: BotSessionEventState;
  /**
   * For `matched`: the pattern the bot watches the terminal for, and how many
   * new lines have matched it so far. Never the text: it stays on the host.
   */
  match?: { pattern: string; count: number } | null;
}

/**
 * A goal a bot set itself keeps it going (`25-bots.md` §4.1; from Grok Bot's
 * goals, `research/lessons-from-grok-bot.md` §9 row 10): after a turn ends
 * with the goal still open, a continuation turn is queued, up to the goal's
 * limit. One goal per bot at a time; an ended goal is deleted. This is the
 * longest objective, in the bot's words.
 */
export const BOT_GOAL_OBJECTIVE_MAX = 500;
/** The continuations a goal may queue: at most this many, and five unless the bot asks for fewer or more. */
export const BOT_GOAL_CONTINUATIONS_MAX = 10;
export const BOT_GOAL_CONTINUATIONS_DEFAULT = 5;

/**
 * What a goal line says: a continuation opens a turn (`continued`); the
 * others say, outside any turn, how the goal ended when the bot did not end
 * it itself (its `end_goal` call is the record of that): the owner stopped
 * it (`cleared`), its continuations ran out (`exhausted`), or a turn of it
 * failed or was stopped (`stopped`).
 */
export const BOT_GOAL_ACTIVITIES = ['continued', 'cleared', 'exhausted', 'stopped'] as const;
export type BotGoalActivity = (typeof BOT_GOAL_ACTIVITIES)[number];

export interface BotGoalEvent {
  kind: 'goal';
  activity: BotGoalActivity;
  goalId: string;
  /** The goal's objective at the time. */
  objective: string;
  /** For `continued`, which continuation this is; otherwise how many ran. */
  step: number;
  /** The goal's limit of continuations. */
  limit: number;
  /** Why, as a code, for `stopped`: the status of the turn that ended it. */
  reason: string | null;
}

/** A bot's goal as the console reads it: `GET /bots/:id/goal`. */
export interface BotGoal {
  id: string;
  objective: string;
  continuations: number;
  limit: number;
  createdAt: string;
}

/**
 * Why a bot turn exists: a message (yours or another bot's), an approval's
 * decision, a card of questions answered or dismissed, a routine's run, a
 * session the bot is subscribed to, or a goal it set itself.
 */
export const BOT_TURN_ORIGINS = [
  'message',
  'approval',
  'question',
  'routine',
  'subscription',
  'goal',
] as const;
export type BotTurnOrigin = (typeof BOT_TURN_ORIGINS)[number];

/**
 * The turns a person is waiting on: one they started by writing, or by
 * deciding a card. A routine's run, a wake and a goal's continuation run
 * with nobody there, so a tool that needs someone to answer is not offered
 * on them.
 */
export const BOT_ATTENDED_ORIGINS = [
  'message',
  'approval',
  'question',
] as const satisfies readonly BotTurnOrigin[];

/**
 * How a bot's answer to another bot's `ask_bot` came back (`25-bots.md`
 * §4.6): its turn ended with an answer, failed, or was stopped.
 */
export const BOT_REPLY_OUTCOMES = ['answered', 'failed', 'cancelled'] as const;
export type BotReplyOutcome = (typeof BOT_REPLY_OUTCOMES)[number];

/**
 * How one of a bot's subagents ended (`25-bots.md` §4.7, `delegate`): it
 * answered, failed, was stopped with the turn, or ran out of its time.
 */
export const BOT_SUBAGENT_STATUSES = ['completed', 'failed', 'cancelled', 'timed_out'] as const;
export type BotSubagentStatus = (typeof BOT_SUBAGENT_STATUSES)[number];

/**
 * One subagent a `delegate` call ran inside the turn: the task it was given,
 * how it ended, what it answered (or why it failed), the tools it called, in
 * order, and what it cost.
 */
export interface BotSubagentRun {
  task: string;
  status: BotSubagentStatus;
  /** Its answer, cut short; on a failure, why. Empty when it said nothing. */
  result: string;
  /** The tools it called, by name, in the order it called them. */
  toolCalls: string[];
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

/**
 * Where one of a `delegate` call's children is while the call runs: waiting
 * for a slot, running, or ended as a {@link BotSubagentStatus}.
 */
export const BOT_SUBAGENT_PROGRESS_STATES = [
  'queued',
  'running',
  ...BOT_SUBAGENT_STATUSES,
] as const;
export type BotSubagentProgressState = (typeof BOT_SUBAGENT_PROGRESS_STATES)[number];

/** The most of a child's task a progress frame carries: enough for its line. */
export const BOT_SUBAGENT_PROGRESS_TASK_MAX = 300;

/**
 * One child of a running `delegate` call, as the chat shows it live: its
 * task, where it is, the tools it has called so far, in order, when it
 * started and, once it has ended, how long it took. The stored
 * {@link BotSubagentRun} replaces it when the call ends.
 */
export const botSubagentProgressSchema = z.object({
  task: z.string().max(BOT_SUBAGENT_PROGRESS_TASK_MAX),
  state: z.enum(BOT_SUBAGENT_PROGRESS_STATES),
  toolCalls: z.array(z.string()),
  /** Null while it waits for a slot. */
  startedAt: z.string().datetime().nullable(),
  /** Null until it has ended. */
  durationMs: z.number().int().nonnegative().nullable(),
});
export type BotSubagentProgress = z.infer<typeof botSubagentProgressSchema>;

/**
 * A message another bot sent this one through `message_bot` or `ask_bot`
 * (`25-bots.md` §4.6). The sender is the bot whose turn made the call, as
 * Oppenheimer recorded it, never a name the message claims; its name is the
 * one it had when it sent. The words are the message's content.
 */
export interface BotPeerMessageEvent {
  kind: 'bot_message';
  /** Null once the sending bot is deleted. */
  fromBotId: string | null;
  fromBotName: string;
  /** Sent with `ask_bot`: this bot's answer goes back to the sender. */
  expectsReply: boolean;
}

/** The answer to an `ask_bot` call, delivered to the bot that asked. */
export interface BotPeerReplyEvent {
  kind: 'bot_reply';
  /** The bot that answered; null once it is deleted. */
  fromBotId: string | null;
  fromBotName: string;
  outcome: BotReplyOutcome;
}

export type BotMessageEvent =
  | BotApprovalEvent
  | BotQuestionEvent
  | BotRoutineEvent
  | BotPeerMessageEvent
  | BotPeerReplyEvent
  | BotSessionEvent
  | BotGoalEvent;

/** The kinds of event, for a reader that checks one before trusting its fields. */
export const BOT_MESSAGE_EVENT_KINDS = [
  'approval',
  'question',
  'routine',
  'bot_message',
  'bot_reply',
  'session',
  'goal',
] as const;
export type BotMessageEventKind = (typeof BOT_MESSAGE_EVENT_KINDS)[number];

/** A message's length; long enough for a pasted page, short enough to keep a turn's prompt bounded. */
export const BOT_MESSAGE_MAX = 16_000;
/** The most messages one conversation read returns, newest first. */
export const BOT_CONVERSATION_PAGE_MAX = 200;
export const BOT_CONVERSATION_PAGE_DEFAULT = 100;

/**
 * The images a message may carry (`25-bots.md` §3.1): the four formats every
 * provider that reads images takes, at most `BOT_IMAGE_MAX_BYTES` each (the
 * strictest provider's limit, Anthropic's), `BOT_MESSAGE_IMAGES_MAX` a message.
 */
export const BOT_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;
export type BotImageMimeType = (typeof BOT_IMAGE_MIME_TYPES)[number];
export const BOT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const BOT_MESSAGE_IMAGES_MAX = 4;
/** An attachment's file name as it is kept: enough to recognise it, never a path. */
export const BOT_ATTACHMENT_NAME_MAX = 255;

/** An image a message carries, as the chat shows it. */
export interface BotAttachment {
  id: string;
  mimeType: BotImageMimeType;
  sizeBytes: number;
  name: string;
}

/**
 * `POST /bots/:id/messages`: what you say to the bot. Words, images uploaded
 * to `POST /bots/:id/attachments` and not sent yet, or both; never neither.
 */
export const sendBotMessageSchema = z
  .object({
    content: z.string().trim().max(BOT_MESSAGE_MAX).default(''),
    attachmentIds: z.array(z.string().uuid()).max(BOT_MESSAGE_IMAGES_MAX).default([]),
    /**
     * The sender's IANA time zone, from their browser. The turn tells the bot
     * the time there, so "tomorrow at 9" means the sender's 9. UTC when absent.
     */
    timeZone: z.string().min(1).max(64).refine(isValidTimeZone).optional(),
  })
  .refine((body) => body.content.length > 0 || body.attachmentIds.length > 0, {
    path: ['content'],
    params: { i18nKey: 'validation.required' },
  })
  .refine((body) => new Set(body.attachmentIds).size === body.attachmentIds.length, {
    path: ['attachmentIds'],
  });
export type SendBotMessageDto = z.infer<typeof sendBotMessageSchema>;

/** `GET /bots/:id/conversation`: the newest `limit` messages, oldest first. */
export const findBotConversationSchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(BOT_CONVERSATION_PAGE_MAX)
    .default(BOT_CONVERSATION_PAGE_DEFAULT),
});
export type FindBotConversationDto = z.infer<typeof findBotConversationSchema>;

/**
 * `PATCH /bots/:id/routines/:routineId`: the Routines tab's switch
 * (`26-bot-routines.md` §7). The tab changes whether a routine runs, never
 * what it is: that is the chat's, through the bot's own tool.
 */
export const updateBotRoutineSchema = z.object({ enabled: z.boolean() });
export type UpdateBotRoutineDto = z.infer<typeof updateBotRoutineSchema>;

/**
 * A Needs input card (`product/versions/mvp/25-bots.md` §5): one call of an
 * asking tool, waiting for the owner. `pending` until they decide; `approved`
 * once the call ran on their yes, `failed` when it ran and failed; `denied`;
 * `expired` when they wrote to the bot instead of answering.
 */
export const BOT_APPROVAL_STATUSES = [
  'pending',
  'approved',
  'denied',
  'expired',
  'failed',
] as const;
export type BotApprovalStatus = (typeof BOT_APPROVAL_STATUSES)[number];

/**
 * What a card may offer, in the order it offers them (`25-bots.md` §5): a
 * yes to this call; a yes that stands for the call's subject, or for the
 * tool; a no the bot is told about and carries on from; and a no that stops
 * the turn, the bot getting no turn back. The API chooses which a card offers
 * (`availableDecisions`) and accepts only those.
 */
export const BOT_APPROVAL_DECISIONS = [
  'approve',
  'approve_for_subject',
  'approve_always',
  'deny',
  'stop',
] as const;
export type BotApprovalDecision = (typeof BOT_APPROVAL_DECISIONS)[number];

/** How a card closed, as the stream says it (`approval_resolved`): decided, or retired. */
export const BOT_APPROVAL_RESOLUTIONS = ['approved', 'denied', 'stopped', 'expired'] as const;
export type BotApprovalResolution = (typeof BOT_APPROVAL_RESOLUTIONS)[number];

/** What the person may add to a decision: why they denied it, or what to do instead. */
export const BOT_APPROVAL_NOTE_MAX = 1_000;

/**
 * How far a yes reaches (`25-bots.md` §5): `once`, this call only; `tool`,
 * every call of the tool from now on (the tool becomes Allow); `subject`,
 * every call of the tool on the same thing (this repository, this session),
 * offered only when the card names one. A tool that is per call only offers
 * `once` alone.
 */
export const BOT_APPROVAL_REACHES = ['once', 'tool', 'subject'] as const;
export type BotApprovalReach = (typeof BOT_APPROVAL_REACHES)[number];

/**
 * A card of questions a bot put to its owner (`ask_user`, `25-bots.md`
 * §3.2): `pending` until they answer it or dismiss it, `expired` when they
 * wrote to the bot instead. Nothing runs on it; the answers go to the bot.
 */
export const BOT_QUESTION_STATUSES = ['pending', 'answered', 'dismissed', 'expired'] as const;
export type BotQuestionStatus = (typeof BOT_QUESTION_STATUSES)[number];

/** How many questions one `ask_user` card holds. */
export const BOT_QUESTIONS_MAX = 4;
/** How many options one question offers, at least and at most. */
export const BOT_QUESTION_OPTIONS_MIN = 2;
export const BOT_QUESTION_OPTIONS_MAX = 4;
export const BOT_QUESTION_TEXT_MAX = 300;
/** The short tag over a question ("Scope"). */
export const BOT_QUESTION_HEADER_MAX = 16;
export const BOT_QUESTION_OPTION_LABEL_MAX = 80;
export const BOT_QUESTION_OPTION_DESCRIPTION_MAX = 200;
/** How long an answer in the person's own words may be. */
export const BOT_QUESTION_ANSWER_MAX = 1_000;

/**
 * One question of an `ask_user` card, the shape Claude Code's
 * `AskUserQuestion` has: a tag, the question, two to four options, and
 * whether several may be picked. The person may always answer in their own
 * words instead.
 */
export const botQuestionSchema = z.object({
  header: z.string().trim().max(BOT_QUESTION_HEADER_MAX).nullable().default(null),
  question: z.string().trim().min(1).max(BOT_QUESTION_TEXT_MAX),
  multiSelect: z.boolean().default(false),
  options: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(BOT_QUESTION_OPTION_LABEL_MAX),
        description: z
          .string()
          .trim()
          .max(BOT_QUESTION_OPTION_DESCRIPTION_MAX)
          .nullable()
          .default(null),
      }),
    )
    .min(BOT_QUESTION_OPTIONS_MIN)
    .max(BOT_QUESTION_OPTIONS_MAX),
});
export type BotQuestion = z.output<typeof botQuestionSchema>;

/** An `ask_user` card's questions, as the bot asked them. */
export const botQuestionsSchema = z.array(botQuestionSchema).min(1).max(BOT_QUESTIONS_MAX);

/** One question's answer: the options picked, by index, and the person's own words. */
export const botQuestionAnswerSchema = z.object({
  picks: z
    .array(
      z
        .number()
        .int()
        .min(0)
        .max(BOT_QUESTION_OPTIONS_MAX - 1),
    )
    .max(BOT_QUESTION_OPTIONS_MAX),
  other: z.string().trim().max(BOT_QUESTION_ANSWER_MAX).nullable().default(null),
});
export type BotQuestionAnswer = z.output<typeof botQuestionAnswerSchema>;

/** `POST /bots/:id/questions/:questionId/answer`: one answer per question, in order. */
export const answerBotQuestionSchema = z.object({
  answers: z.array(botQuestionAnswerSchema).min(1).max(BOT_QUESTIONS_MAX),
});
export type AnswerBotQuestionDto = z.infer<typeof answerBotQuestionSchema>;

/** `POST /bots/:id/questions/:questionId/dismiss`: why not, optionally. */
export const dismissBotQuestionSchema = z.object({
  note: z.string().trim().max(BOT_APPROVAL_NOTE_MAX).optional(),
});
export type DismissBotQuestionDto = z.infer<typeof dismissBotQuestionSchema>;

/**
 * `POST /bots/:id/approvals/:approvalId/decision`: one of the card's
 * `availableDecisions`. `reach` is the older way to say how far a yes goes
 * (`approve` with `tool` is `approve_always`, with `subject`
 * `approve_for_subject`); a no ignores it.
 */
export const decideBotApprovalSchema = z.object({
  decision: z.enum(BOT_APPROVAL_DECISIONS),
  note: z.string().trim().max(BOT_APPROVAL_NOTE_MAX).optional(),
  reach: z.enum(BOT_APPROVAL_REACHES).default('once'),
});

/**
 * What a bot may do with one tool, set by its owner in Settings →
 * Permissions (`25-bots.md` §5): `allow` runs without asking, `ask` raises a
 * Needs input card, `off` takes the tool away (the model never sees it). A
 * tool with no setting follows the bot's preset and the tool's own default.
 */
export const BOT_TOOL_DECISIONS = ['allow', 'ask', 'off'] as const;
export type BotToolDecision = (typeof BOT_TOOL_DECISIONS)[number];

/**
 * The groups Settings → Permissions lists a bot's tools under, in order:
 * `25-bots.md` §4.1 to §4.7 (itself, sessions, projects and the plan,
 * GitHub, automations, other bots, work and the web).
 */
export const BOT_TOOL_GROUPS = [
  'self',
  'sessions',
  'plan',
  'mail',
  'github',
  'automations',
  'bots',
  'web',
] as const;
export type BotToolGroup = (typeof BOT_TOOL_GROUPS)[number];

/** `PUT /bots/:id/permissions/tools/:tool`: a decision, or `default` to drop the setting. */
export const setBotToolDecisionSchema = z.object({
  decision: z.enum([...BOT_TOOL_DECISIONS, 'default']),
});
export type SetBotToolDecisionDto = z.infer<typeof setBotToolDecisionSchema>;

/**
 * A plain-language rule a reviewer reads before an asking call
 * (`25-bots.md` §5): `allow` lets a matching call run without a card, `ask`
 * makes one ask even where it would not. When both match, `ask` wins.
 */
export const BOT_PERMISSION_RULE_EFFECTS = ['allow', 'ask'] as const;
export type BotPermissionRuleEffect = (typeof BOT_PERMISSION_RULE_EFFECTS)[number];

/** One rule's words: a sentence, never a policy document. */
export const BOT_PERMISSION_RULE_MAX = 280;
/** Rules one bot may hold, both kinds together: the reviewer reads them all on every call. */
export const BOT_PERMISSION_RULES_MAX = 20;
/** Standing grants one bot may hold for single subjects (`reach: 'subject'`). */
export const BOT_TOOL_GRANTS_MAX = 100;

/** `POST /bots/:id/permissions/rules`. */
export const createBotPermissionRuleSchema = z.object({
  effect: z.enum(BOT_PERMISSION_RULE_EFFECTS),
  text: z.string().trim().min(1).max(BOT_PERMISSION_RULE_MAX),
});
export type CreateBotPermissionRuleDto = z.infer<typeof createBotPermissionRuleSchema>;
export type DecideBotApprovalDto = z.infer<typeof decideBotApprovalSchema>;

/**
 * The decision a `decideBotApprovalSchema` body names, the older shape read
 * once at the edge: `approve` with `reach` `tool` is `approve_always`, with
 * `subject` `approve_for_subject`. A named decision wins over a reach.
 */
export function namedBotApprovalDecision({
  decision,
  reach,
}: Pick<DecideBotApprovalDto, 'decision' | 'reach'>): BotApprovalDecision {
  if (decision !== 'approve') return decision;
  if (reach === 'tool') return 'approve_always';
  if (reach === 'subject') return 'approve_for_subject';
  return 'approve';
}

/** What the console's Deny asks for: the note alone, optional. */
export const denyBotApprovalSchema = decideBotApprovalSchema.pick({ note: true });
export type DenyBotApprovalDto = z.infer<typeof denyBotApprovalSchema>;

/** `GET /bots/:id/approvals`: newest first, every status unless one is named. */
export const findBotApprovalsSchema = z.object({
  status: z.enum(BOT_APPROVAL_STATUSES).optional(),
});
export type FindBotApprovalsDto = z.infer<typeof findBotApprovalsSchema>;

/** The most approvals one read returns, newest first. */
export const BOT_APPROVALS_PAGE_MAX = 50;

/**
 * `GET /bot-approvals`: the workspace's approvals across its bots, in one
 * status, `pending` unless another is named (the Inbox, `29-inbox.md` §4).
 */
export const findWorkspaceBotApprovalsSchema = z.object({
  status: z.enum(BOT_APPROVAL_STATUSES).default('pending'),
});
export type FindWorkspaceBotApprovalsDto = z.infer<typeof findWorkspaceBotApprovalsSchema>;

/** The most approvals the workspace read returns, newest first. */
export const WORKSPACE_BOT_APPROVALS_MAX = 100;

/**
 * Where a piece of a turn's streamed text belongs. `block` counts the blocks
 * of text the turn stored before this one (a block of only whitespace is not
 * stored, and does not count), so a block is drawn live until the
 * conversation holds that many of the turn's assistant messages with text.
 * `seq` counts the turn's text writes, 1 for the first: a piece at or below
 * what a reader already holds is one it has.
 */
const botStreamTextPlace = {
  turnId: z.string(),
  block: z.number().int().nonnegative(),
  seq: z.number().int().nonnegative(),
};

/**
 * What `GET /bots/:id/stream` sends, as the `data` of a `bot` event: text as a
 * turn writes it, that it waits on a provider that refused a call, where a running `delegate` call's children are, a nudge to read the conversation again when a message
 * lands or a turn changes, and one to read the approvals when a card is
 * raised or settled. The stored messages are the record; this is how
 * they arrive early.
 */
export const botStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('turn'), turnId: z.string(), status: z.enum(BOT_TURN_STATUSES) }),
  /** A delta of the block being written, the turn's `seq`th text write. */
  z.object({ type: z.literal('text'), ...botStreamTextPlace, text: z.string() }),
  /**
   * The whole of the block a running turn is writing and has not stored, as
   * of its `seq`th write: sent once per running turn right after `ready`, in
   * place of what the reader held for that block, so a reconnect loses no
   * text. Deltas at or below `seq` that follow are already in it.
   */
  z.object({ type: z.literal('snapshot'), ...botStreamTextPlace, text: z.string() }),
  /**
   * The provider refused a call and the turn waits to try it again: a rate
   * limit, or the provider overloaded or down. Until the turn writes again.
   */
  z.object({
    type: z.literal('retrying'),
    turnId: z.string(),
    reason: z.enum(['rate_limit', 'unavailable']),
  }),
  /** `turnId` is null for a line outside any turn, such as a routine's activity. */
  z.object({ type: z.literal('message'), turnId: z.string().nullable(), messageId: z.string() }),
  z.object({
    type: z.literal('approval'),
    approvalId: z.string(),
    status: z.enum(BOT_APPROVAL_STATUSES),
  }),
  /**
   * A card closed, by whichever tab, device or token decided it, or retired
   * by a new message: every open chat takes the card down at once, without
   * waiting to read the approvals again, and draws how it went.
   */
  z.object({
    type: z.literal('approval_resolved'),
    approvalId: z.string(),
    outcome: z.enum(BOT_APPROVAL_RESOLUTIONS),
    tool: z.string(),
    summary: z.string(),
  }),
  /** A card of questions (`ask_user`) was raised, answered, dismissed or retired. */
  z.object({
    type: z.literal('question'),
    questionId: z.string(),
    status: z.enum(BOT_QUESTION_STATUSES),
  }),
  /**
   * Where each child of a running `delegate` call is, the whole set each
   * time one moves; `callId` is the call's step. Never stored: the call's
   * step carries the runs once it ends.
   */
  z.object({
    type: z.literal('subagents'),
    turnId: z.string(),
    callId: z.string(),
    runs: z.array(botSubagentProgressSchema),
  }),
]);
export type BotStreamEvent = z.infer<typeof botStreamEventSchema>;
export type BotStreamText = Extract<BotStreamEvent, { type: 'text' }>;
export type BotStreamSnapshot = Extract<BotStreamEvent, { type: 'snapshot' }>;

/** The SSE event names on a bot's stream. */
export const BOT_STREAM_READY = 'ready';
export const BOT_STREAM_EVENT = 'bot';
