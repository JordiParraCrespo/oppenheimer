import { Injectable } from '@nestjs/common';
import { BotConversationSummaryOrmEntity } from './database/bot-conversation-summary.orm-entity';
import { BotConversationSummaryEntity } from './domain/bot-conversation-summary.entity';

/** A bot's conversation summary between its row and the aggregate; it has no response: no route reads it. */
@Injectable()
export class BotConversationSummaryMapper {
  toPersistence(entity: BotConversationSummaryEntity): BotConversationSummaryOrmEntity {
    const record = new BotConversationSummaryOrmEntity();
    record.organizationId = entity.organizationId;
    record.botId = entity.botId;
    record.content = entity.content;
    record.coversThroughMessageId = entity.coversThroughMessageId;
    record.coversThroughCreatedAt = entity.coversThroughCreatedAt;
    record.version = entity.versionAtLoad;
    return record;
  }

  toDomain(record: BotConversationSummaryOrmEntity): BotConversationSummaryEntity {
    return BotConversationSummaryEntity.create({
      id: record.botId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        botId: record.botId,
        content: record.content,
        coversThroughMessageId: record.coversThroughMessageId,
        coversThroughCreatedAt: record.coversThroughCreatedAt,
        version: record.version,
      },
    });
  }
}
