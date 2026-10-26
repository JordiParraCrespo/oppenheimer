import type { Option } from 'oxide.ts';
import type { BotAttachmentEntity } from '../domain/bot-attachment.entity';

export interface BotAttachmentRepositoryPort {
  insert(attachment: BotAttachmentEntity): Promise<void>;
  /** One image of a bot, sent or not. */
  findForBot(
    organizationId: string,
    botId: string,
    id: string,
  ): Promise<Option<BotAttachmentEntity>>;
  /** The images of a bot among `ids`, in no order; an id that names none is left out. */
  findManyForBot(
    organizationId: string,
    botId: string,
    ids: readonly string[],
  ): Promise<BotAttachmentEntity[]>;
  /** The images a message carries, in no order. */
  findForMessage(organizationId: string, messageId: string): Promise<BotAttachmentEntity[]>;
  /**
   * The oldest `limit` images no message carries that were uploaded before
   * `cutoff`: never sent, or their message is gone. Every workspace's.
   */
  findUnclaimedBefore(cutoff: Date, limit: number): Promise<BotAttachmentEntity[]>;
  /** Deletes the rows of `ids` that are still unclaimed; how many it deleted. */
  deleteUnclaimed(ids: readonly string[]): Promise<number>;
}
