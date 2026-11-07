import type { Option } from 'oxide.ts';
import type { DreamedFact, StoredDream } from '../domain/bot-dream.policy';

/** What the trigger weighs: the facts a dream would rewrite, and the writes since the last one. */
export interface DreamWeight {
  rewritable: number;
  writesSince: number;
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
  /** The bot's latest dream, in its workspace. */
  findLatest(organizationId: string, botId: string): Promise<Option<StoredDream>>;
  /** How many facts the bot wrote itself, how many it wrote since its last dream, and when that was. */
  weigh(organizationId: string, botId: string): Promise<DreamWeight>;
  /**
   * Replaces the facts the dream read with the ones it wrote, and stores the
   * dream with the facts it replaced, all under a lock on the bot's row.
   * `changed` when the bot's facts are no longer the ones it read (a save, an
   * edit or a forget came first): nothing is written, and the next dream
   * reads them again. `missing` when the bot is gone.
   */
  apply(dream: DreamWrite, max: number): Promise<'applied' | 'changed' | 'missing'>;
  /**
   * Puts back the facts the bot's latest dream replaced, and deletes those it
   * wrote; what the bot saved since stays, its oldest `log` facts making room
   * past `max`. The dream as it was undone, or null when there is none to undo.
   */
  undo(organizationId: string, botId: string, max: number): Promise<StoredDream | null>;
  /** Stages a dream of the bot's memory; `force` runs it whatever the trigger would say. */
  stageDream(
    organizationId: string,
    botId: string,
    force: boolean,
    correlationId: string | null,
  ): Promise<void>;
}
