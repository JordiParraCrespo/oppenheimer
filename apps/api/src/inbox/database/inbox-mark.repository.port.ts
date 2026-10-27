import type { Option } from 'oxide.ts';
import type { InboxMarkEntity } from '../domain/inbox-mark.entity';

export interface InboxMarkRepositoryPort {
  /**
   * Stores the mark on its occurrence, replacing the one the person had there
   * (`UQ_inbox_mark_item`), with its event in the same transaction. Two puts
   * at once both land; the last one is the mark.
   */
  upsert(mark: InboxMarkEntity): Promise<void>;

  /** The person's mark on one occurrence in the workspace. */
  findOne(
    organizationId: string,
    userId: string,
    itemKey: string,
  ): Promise<Option<InboxMarkEntity>>;

  /**
   * The person's marks in the workspace that still hold at `now` (a snooze
   * whose end has passed does not), the newest changed first, at most `limit`.
   */
  findInForce(
    organizationId: string,
    userId: string,
    now: Date,
    limit: number,
  ): Promise<InboxMarkEntity[]>;

  /** Removes the mark, with its event; whether there was one to remove. */
  delete(mark: InboxMarkEntity): Promise<boolean>;
}
