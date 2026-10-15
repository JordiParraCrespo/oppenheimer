import { z } from 'zod';
import { SESSION_EFFORTS, type SessionPermission } from '../agents/catalog.js';

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
  /** A Claude Code model id from the agents catalog; `null` is Claude Code's default. */
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
