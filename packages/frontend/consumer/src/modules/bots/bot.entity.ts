import type { AppError } from '@oppenheimer/frontend-core';
import type { SessionEffort } from '@oppenheimer/shared/agents';
import type { AutomationRunStatus } from '@oppenheimer/shared/automations';
import type {
  BotAuthor,
  BotAvatarColor,
  BotDocumentName,
  BotMemoryScope,
  BotMemoryTier,
  BotPermission,
  BotProvider,
  BotSection,
} from '@oppenheimer/shared/schemas/bot';
import type { AutomationStatus, AutomationTrigger } from '../automations/automation.entity';

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
    /** Who answers it: Anthropic, GLM or OpenAI. */
    public readonly provider: BotProvider,
    /** A model id its provider offers; `null` runs the provider's default. */
    public readonly model: string | null,
    public readonly effort: SessionEffort | null,
    public readonly permission: BotPermission,
    public readonly learnAutomatically: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    /** When it last changed; from the chat slice, its last message. */
    public readonly lastActivityAt: Date,
    /** The start of its last message; `null` before the first. */
    public readonly lastMessagePreview: string | null = null,
    /** The console sections whose sidebar lists it beside Employees, in catalog order. */
    public readonly sections: BotSection[] = [],
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
    /** `profile`: in mind every turn. `log`: looked up with `recall` when needed. */
    public readonly tier: BotMemoryTier,
    /** `bot`: this bot's alone. `person`: about its owner, read by all their bots. */
    public readonly scope: BotMemoryScope,
    /** The bot that keeps it, which is another of the owner's bots for a shared fact. */
    public readonly botId: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  /** Reworded since it was written. */
  get isEdited(): boolean {
    return this.updatedAt.getTime() !== this.createdAt.getTime();
  }

  /** Kept by another of the owner's bots and shared with this one: read, never changed here. */
  isSharedWith(botId: string): boolean {
    return this.botId !== botId;
  }
}

/** A change to a fact: its words, its tier or its scope; what is left out stays. */
export interface UpdateBotFactInput {
  content?: string;
  tier?: BotMemoryTier;
  scope?: BotMemoryScope;
}

/** `PATCH /bots/:id`: a field left out is unchanged; `null` clears what can be cleared. */
export interface UpdateBotInput {
  name?: string;
  description?: string;
  avatarColor?: BotAvatarColor;
  groupId?: string | null;
  position?: number;
  homeHostId?: string | null;
  /** A new provider with no model runs that provider's default. */
  provider?: BotProvider;
  model?: string | null;
  effort?: SessionEffort | null;
  permission?: BotPermission;
  learnAutomatically?: boolean;
  /** The whole set; `[]` shows it in Employees only. */
  sections?: BotSection[];
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

/**
 * One model provider as the workspace has it: whether a key is stored and its
 * last four characters, and whether a new bot starts on it. The key itself
 * never reaches the console.
 */
export class ModelProviderEntity {
  constructor(
    public readonly provider: BotProvider,
    public readonly configured: boolean,
    public readonly keyHint: string | null,
    public readonly updatedAt: Date | null,
    /** Exactly one provider is: the one marked, else the key stored first, else Anthropic. */
    public readonly isDefault: boolean,
  ) {}
}

/**
 * A ChatGPT sign-in in progress: the code the person types on OpenAI's page,
 * and the sealed handle the console polls with. Nothing in it is a credential
 * the console could use; the tokens stay on the server.
 */
export class ChatgptLoginEntity {
  constructor(
    public readonly flowId: string,
    public readonly userCode: string,
    public readonly verificationUrl: string,
    public readonly intervalSeconds: number,
    public readonly expiresAt: Date,
  ) {}
}

/** Where a ChatGPT sign-in stands, as the dialog draws it. */
export type ChatgptLoginState = 'pending' | 'connected' | 'expired';

/** The code the API answers a poll of a lapsed or refused sign-in with. */
const CHATGPT_LOGIN_EXPIRED = 'BOTS_018';

/** Whether `error` is the API saying the sign-in being polled is over, and a new one is needed. */
export function isChatgptLoginExpired(error: unknown): boolean {
  return (error as Partial<AppError> | null)?.code === CHATGPT_LOGIN_EXPIRED;
}

/** How a routine's latest run went, as its card's "Last" reads it. */
export interface BotRoutineLastRun {
  status: AutomationRunStatus;
  createdAt: Date;
}

/**
 * One of a bot's routines (`26-bot-routines.md` §7): what it is told, when it
 * runs, whether it is on, and how it last went. The bot makes and changes it
 * in chat; the Routines tab turns it on or off, runs it now or deletes it.
 */
export class BotRoutineEntity {
  constructor(
    public readonly id: string,
    /** The bot that runs it. */
    public readonly botId: string,
    public readonly name: string,
    public readonly prompt: string,
    /** `running` while a run is going, paused or not: the pause is {@link isPaused}. */
    public readonly status: AutomationStatus,
    /** Whether its triggers are paused; a paused routine can still be run now. */
    public readonly isPaused: boolean,
    public readonly nextRunAt: Date | null,
    public readonly triggers: AutomationTrigger[],
    public readonly lastRun: BotRoutineLastRun | null,
    public readonly updatedAt: Date,
  ) {}

  /** A run is queued or its turn is running. */
  get isRunning(): boolean {
    return this.status === 'running';
  }
}
