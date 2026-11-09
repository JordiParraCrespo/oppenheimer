import type { BotAuthor, BotDocumentName } from '@oppenheimer/shared';

/** Who made a change to a bot's documents or memory: a person, or the bot through its tools. */
export type BotActor = { kind: 'user'; userId: string } | { kind: 'bot' };

export function userActor(userId: string): BotActor {
  return { kind: 'user', userId };
}

export function authorOf(actor: BotActor): { author: BotAuthor; authorUserId: string | null } {
  return actor.kind === 'user'
    ? { author: 'user', authorUserId: actor.userId }
    : { author: 'bot', authorUserId: null };
}

/** Where a move puts a bot or a group: at an index among its siblings, or after them all. */
export type Placement = number | 'last';

/** One saved version of a document. Append-only: a revert writes a new one. */
export interface BotDocumentRevision {
  id: string;
  organizationId: string;
  botId: string;
  name: BotDocumentName;
  revision: number;
  content: string;
  author: BotAuthor;
  authorUserId: string | null;
  note: string;
  /** The revision whose content this one restored, when it is a revert. */
  revertedFrom: number | null;
  createdAt: Date;
}

/**
 * What a person wrote about themselves for their bots (Settings → Memory):
 * in the system prompt of every bot they made in the workspace. Their bots
 * read it and never write it.
 */
export interface PersonAbout {
  organizationId: string;
  userId: string;
  about: string;
  /** When it was last saved; `null` when nothing was ever written. */
  updatedAt: Date | null;
}
