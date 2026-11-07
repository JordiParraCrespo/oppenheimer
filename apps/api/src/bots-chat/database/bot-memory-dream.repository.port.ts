import type { DreamedFact, DreamState, StoredDream } from '../domain/bot-dream.policy';

/** What the trigger weighs: the facts a dream would rewrite, and the writes since the last one. */
export interface DreamWeight {
  rewritable: number;
  /** The bot's facts written since its last dream that wrote, or since it began. */
  writesSince: number;
  /** When a dream last started, whether or not it wrote anything. */
  lastDreamAt: Date | null;
}

/** A dream to store: the facts it read, by id and when each was last written, and what replaces them. */
export interface DreamWrite {
  id: string;
  organizationId: string;
  botId: string;
  read: readonly { id: string; updatedAt: Date }[];
  facts: readonly DreamedFact[];
  note: string | null;
}

export interface BotMemoryDreamRepositoryPort {
  /** The bot's latest dream, in its workspace, and whether one its owner asked for is under way. */
  findState(organizationId: string, botId: string): Promise<DreamState>;
  /** How many facts the bot wrote itself, how many it wrote since its last dream, and when one last started. */
  weigh(organizationId: string, botId: string): Promise<DreamWeight>;
  /** Records that a dream of the bot starts now, so the trigger waits a day whatever it comes to. */
  markTried(organizationId: string, botId: string): Promise<void>;
  /**
   * Replaces the facts the dream read with the ones it wrote, and stores the
   * dream with the facts it replaced, under a lock on the bot's row and on
   * each of its facts.
   * `changed` when the bot's facts are no longer the ones it read (a save, an
   * edit or a forget came first): nothing is written, and the next dream
   * reads them again. `missing` when the bot is gone.
   */
  apply(dream: DreamWrite, max: number): Promise<'applied' | 'changed' | 'missing'>;
  /**
   * Puts back the facts the bot's latest dream replaced, and deletes those it
   * wrote that the owner has not edited since; what was saved since stays,
   * the bot's own oldest `log` facts making room past `max`. The dream as it was undone, or null when there is none to undo.
   */
  undo(organizationId: string, botId: string, max: number): Promise<StoredDream | null>;
  /** Stages a dream the trigger owes the bot. */
  stageDream(organizationId: string, botId: string, correlationId: string | null): Promise<void>;
  /**
   * Its owner's Tidy now: marks a dream under way and stages it, in one
   * write, so the console reads `pending` until the job settles it.
   */
  requestDream(organizationId: string, botId: string, correlationId: string | null): Promise<void>;
  /** The dream job is done, whatever it came to: nothing is under way any more. */
  settle(organizationId: string, botId: string): Promise<void>;
}
