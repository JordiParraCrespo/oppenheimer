import type { EntityManager } from 'typeorm';

/**
 * A bot's conversation as one thing, apart from its turns: what Clear
 * history erases besides them. It owns no transaction of its own; the turn
 * repository calls it under the lock a send takes, on that transaction's
 * manager, so the deletes and the check that no turn works are one write.
 */
export interface BotConversationRepositoryPort {
  /**
   * Deletes the bot's summary, its approvals (a pending card ends with the
   * conversation) and its messages, and empties its sidebar line, on
   * `manager`. The turns are the caller's.
   */
  deleteWithin(manager: EntityManager, organizationId: string, botId: string): Promise<void>;
}
