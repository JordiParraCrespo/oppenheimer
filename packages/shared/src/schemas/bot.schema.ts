import { z } from 'zod';
import {
  CODING_AGENTS,
  type CodingAgentEffort,
  SESSION_EFFORTS,
  type SessionEffort,
  type SessionPermission,
} from '../agents/catalog.js';
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
/** How many facts one bot may keep. The bot reads them all before every turn. */
export const BOT_MEMORY_FACTS_MAX = 200;
/** The most revisions one read returns, newest first. */
export const BOT_REVISIONS_PAGE_MAX = 100;
export const BOT_REVISIONS_PAGE_DEFAULT = 50;

/** What a bot created without a name is called, numbered when the workspace has one. */
export const BOT_DEFAULT_NAME = 'New Bot';

/**
 * A new bot's `SOUL.md`, the design's template with `{name}` replaced by the
 * bot's name. Its `INSTRUCTIONS.md` starts empty: the bot's first answer
 * proposes one (slice 3).
 */
export const BOT_SOUL_TEMPLATE =
  '# Soul\n\nYou are {name}. You speak like a calm colleague: short sentences, numbers over adjectives, no exclamation marks.\n\nYou never pretend a step finished when it did not.\n';

export function botSoulFor(name: string): string {
  return BOT_SOUL_TEMPLATE.replace('{name}', name);
}

/**
 * Who answers a bot (`product/versions/mvp/25-bots.md` §2): the provider picks
 * the engine, Anthropic and GLM the Claude Agent SDK, OpenAI the OpenAI Agents
 * SDK. Each runs on the workspace's own key for it.
 */
export const BOT_PROVIDERS = ['anthropic', 'glm', 'openai'] as const;
export type BotProvider = (typeof BOT_PROVIDERS)[number];

/** One model a bot may run on, as the composer's model chip lists it. */
export interface BotModel {
  readonly id: string;
  readonly label: string;
  readonly default?: true;
  readonly effort?: CodingAgentEffort;
}

export interface BotProviderDefinition {
  readonly id: BotProvider;
  readonly label: string;
  readonly models: readonly BotModel[];
}

const GLM_LEVELS = Object.freeze({
  levels: Object.freeze(['low', 'medium', 'high'] as SessionEffort[]),
  default: 'medium' as SessionEffort,
});

/**
 * The models each provider offers a bot. Anthropic's and OpenAI's are the rows
 * the coding agents already list (Claude Code's, Codex's), so a model offered to
 * a session and to a bot is one row; GLM's are z.ai's, reached through its
 * Anthropic-compatible endpoint.
 */
export const BOT_PROVIDER_CATALOG: Readonly<Record<BotProvider, BotProviderDefinition>> =
  Object.freeze({
    anthropic: Object.freeze({
      id: 'anthropic',
      label: 'Anthropic',
      models: CODING_AGENTS['claude-code'].models,
    }),
    glm: Object.freeze({
      id: 'glm',
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
      label: 'OpenAI',
      models: CODING_AGENTS.codex.models,
    }),
  });

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

export const botAvatarColorSchema = z.enum(BOT_AVATAR_COLORS);
export const botDocumentNameSchema = z.enum(BOT_DOCUMENT_NAMES);
export const botPermissionSchema = z.enum(BOT_PERMISSIONS);

const botNameSchema = z.string().trim().min(1).max(BOT_NAME_MAX);
const botDescriptionSchema = z.string().trim().max(BOT_DESCRIPTION_MAX);
const botGroupNameSchema = z.string().trim().min(1).max(BOT_GROUP_NAME_MAX);
const memoryFactContentSchema = z.string().trim().min(1).max(BOT_MEMORY_FACT_MAX);
const positionSchema = z.number().int().min(0).max(10_000);

/**
 * `POST /bots`. Everything is optional: a blank bot is "New Bot" (numbered
 * when the workspace has one), on the next avatar colour, ungrouped, with no
 * home host until one is chosen.
 */
export const createBotSchema = z.object({
  name: botNameSchema.optional(),
  description: botDescriptionSchema.optional(),
  avatarColor: botAvatarColorSchema.optional(),
  groupId: z.string().uuid().nullable().optional(),
  homeHostId: z.string().uuid().nullable().optional(),
  /** Anthropic unless named; the model is then the provider's default. */
  provider: botProviderSchema.optional(),
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

/** `POST /bots/:id/memory` and `PATCH /bots/:id/memory/:factId`: one fact, in a sentence. */
export const botMemoryFactSchema = z.object({
  content: memoryFactContentSchema,
});
export type BotMemoryFactDto = z.infer<typeof botMemoryFactSchema>;

/**
 * A bot's turn (`product/versions/mvp/25-bots.md` §2): one message of yours
 * and what the bot did with it. `queued` waits for the bot's turn before it;
 * one turn per bot runs at a time.
 */
export const BOT_TURN_STATUSES = ['queued', 'running', 'completed', 'cancelled', 'failed'] as const;
export type BotTurnStatus = (typeof BOT_TURN_STATUSES)[number];

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

/** A message's length; long enough for a pasted page, short enough to keep a turn's prompt bounded. */
export const BOT_MESSAGE_MAX = 16_000;
/** The most messages one conversation read returns, newest first. */
export const BOT_CONVERSATION_PAGE_MAX = 200;
export const BOT_CONVERSATION_PAGE_DEFAULT = 100;

/** `POST /bots/:id/messages`: what you say to the bot. */
export const sendBotMessageSchema = z.object({
  content: z.string().trim().min(1).max(BOT_MESSAGE_MAX),
  /**
   * The sender's IANA time zone, from their browser. The turn tells the bot
   * the time there, so "tomorrow at 9" means the sender's 9. UTC when absent.
   */
  timeZone: z.string().min(1).max(64).refine(isValidTimeZone).optional(),
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

export const BOT_APPROVAL_DECISIONS = ['approve', 'deny'] as const;
export type BotApprovalDecision = (typeof BOT_APPROVAL_DECISIONS)[number];

/** What the person may add to a decision: why they denied it, or what to do instead. */
export const BOT_APPROVAL_NOTE_MAX = 1_000;

/** `POST /bots/:id/approvals/:approvalId/decision`. */
export const decideBotApprovalSchema = z.object({
  decision: z.enum(BOT_APPROVAL_DECISIONS),
  note: z.string().trim().max(BOT_APPROVAL_NOTE_MAX).optional(),
});
export type DecideBotApprovalDto = z.infer<typeof decideBotApprovalSchema>;

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
 * What `GET /bots/:id/stream` sends, as the `data` of a `bot` event: text as a
 * turn writes it, a nudge to read the conversation again when a message
 * lands or a turn changes, and one to read the approvals when a card is
 * raised or settled. The stored messages are the record; this is how
 * they arrive early.
 */
export const botStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('turn'), turnId: z.string(), status: z.enum(BOT_TURN_STATUSES) }),
  z.object({ type: z.literal('text'), turnId: z.string(), text: z.string() }),
  z.object({ type: z.literal('message'), turnId: z.string(), messageId: z.string() }),
  z.object({
    type: z.literal('approval'),
    approvalId: z.string(),
    status: z.enum(BOT_APPROVAL_STATUSES),
  }),
]);
export type BotStreamEvent = z.infer<typeof botStreamEventSchema>;

/** The SSE event names on a bot's stream. */
export const BOT_STREAM_READY = 'ready';
export const BOT_STREAM_EVENT = 'bot';
