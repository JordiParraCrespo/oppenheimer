import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { BotConversationRepositoryPort } from './bot-conversation.repository.port';

@Injectable()
export class BotConversationRepository implements BotConversationRepositoryPort {
  async deleteWithin(manager: EntityManager, organizationId: string, botId: string): Promise<void> {
    const params = [organizationId, botId];
    // Each by its bot index (the summary by its key), children before the
    // turns the caller deletes after, so no row is left to a cascade.
    await manager.query(
      `DELETE FROM bot_conversation_summary WHERE "organizationId" = $1 AND "botId" = $2`,
      params,
    );
    await manager.query(
      `DELETE FROM bot_approval WHERE "organizationId" = $1 AND "botId" = $2`,
      params,
    );
    await manager.query(
      `DELETE FROM bot_question WHERE "organizationId" = $1 AND "botId" = $2`,
      params,
    );
    await manager.query(
      `DELETE FROM bot_message WHERE "organizationId" = $1 AND "botId" = $2`,
      params,
    );
    await manager.query(
      `UPDATE bot SET "lastMessageAt" = NULL, "lastMessagePreview" = NULL
        WHERE "organizationId" = $1 AND id = $2`,
      params,
    );
  }
}
