import type { AppError } from '@oppenheimer/frontend-core';
import type { SessionEffort } from '@oppenheimer/shared/agents';
import type {
  BotAuthor,
  BotAvatarColor,
  BotDocumentName,
  BotPermission,
} from '@oppenheimer/shared/schemas/bot';

/**
 * A bot as the console needs it (`product/versions/mvp/25-bots.md`): who it
 * is, where it sits in the Employees sidebar, the host it runs on and how its
 * turns start. What it is told and what it remembers are read separately
 * ({@link BotDocumentEntity}, {@link BotMemoryFactEntity}).
 */
export class BotEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    public readonly avatarColor: BotAvatarColor,
    /** Its sidebar group; `null` is Ungrouped. */
    public readonly groupId: string | null,
    /** Its order inside its group, from 0. */
    public readonly position: number,
    /** The host its turns run on; `null` until one is chosen. */
    public readonly homeHostId: string | null,
    /** A Claude Code model id; `null` runs Claude Code's default. */
    public readonly model: string | null,
    public readonly effort: SessionEffort,
    public readonly permission: BotPermission,
    public readonly learnAutomatically: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    /** When it last changed; from the chat slice, its last message. */
    public readonly lastActivityAt: Date,
  ) {}

  /**
   * The letters its avatar draws: the first of the first two words ("New Bot"
   * is NB), or the first two letters of a one-word name, upper-cased.
   */
  get initials(): string {
    const words = this.name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '?';
    if (words.length === 1)
      return Array.from(words[0] as string)
        .slice(0, 2)
        .join('')
        .toUpperCase();
    return words
      .slice(0, 2)
      .map((word) => Array.from(word)[0])
      .join('')
      .toUpperCase();
  }
}

/** A group in the Employees sidebar, in the reader's order. */
export class BotGroupEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly position: number,
    public readonly createdAt: Date,
  ) {}
}

/**
 * `SOUL.md` or `INSTRUCTIONS.md` as it stands: the text and the revision a
 * save sends back as `baseRevision`.
 */
export class BotDocumentEntity {
  constructor(
    public readonly name: BotDocumentName,
    public readonly content: string,
    public readonly revision: number,
    public readonly updatedBy: BotAuthor,
    public readonly updatedAt: Date,
  ) {}

  /** Nothing written yet: a new bot's instructions, before it proposes its own. */
  get isBlank(): boolean {
    return this.content.trim() === '';
  }
}

/** One revision in a document's history, newest first. */
export class BotDocumentRevisionEntity {
  constructor(
    public readonly id: string,
    public readonly name: BotDocumentName,
    /** Revision 1 is the one the bot was created with. */
    public readonly revision: number,
    public readonly content: string,
    public readonly author: BotAuthor,
    /** What the writer said about the change; may be empty. */
    public readonly note: string,
    /** The revision whose content this one restored, when it is a revert. */
    public readonly revertedFrom: number | null,
    public readonly createdAt: Date,
  ) {}
}

/** One thing a bot remembers, in a sentence. */
export class BotMemoryFactEntity {
  constructor(
    public readonly id: string,
    public readonly content: string,
    /** Who wrote it last: the reader, or the bot through its tools. */
    public readonly source: BotAuthor,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  /** Reworded since it was written. */
  get isEdited(): boolean {
    return this.updatedAt.getTime() !== this.createdAt.getTime();
  }
}

/** `PATCH /bots/:id`: a field left out is unchanged; `null` clears what can be cleared. */
export interface UpdateBotInput {
  name?: string;
  description?: string;
  avatarColor?: BotAvatarColor;
  groupId?: string | null;
  position?: number;
  homeHostId?: string | null;
  model?: string | null;
  effort?: SessionEffort | null;
  permission?: BotPermission;
  learnAutomatically?: boolean;
}

/** `PUT /bots/:id/documents/:name`: the text, over the revision the editor loaded. */
export interface SaveBotDocumentInput {
  content: string;
  baseRevision: number;
  note?: string;
}

/** The code the API answers a save over a newer revision with. */
const DOCUMENT_CONFLICT = 'BOTS_006';

/**
 * The revision a document is at now, when `error` is the API refusing a save
 * because somebody saved it since the editor loaded it; `null` for any other
 * failure. The problem document carries it as `revision`.
 */
export function documentConflictRevision(error: unknown): number | null {
  const appError = error as Partial<AppError> | null;
  if (!appError || appError.code !== DOCUMENT_CONFLICT) return null;
  const revision = appError.problem?.revision;
  return typeof revision === 'number' ? revision : null;
}
