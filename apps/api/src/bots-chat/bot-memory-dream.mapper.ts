import { Injectable } from '@nestjs/common';
import type { BotMemoryDream } from '@oppenheimer/shared';
import type { BotMemoryDreamOrmEntity } from './database/bot-memory-dream.orm-entity';
import type { BotMemoryFactEntity } from '../bots/domain/bot-memory-fact.entity';
import type { DreamFact, StoredDream } from './domain/bot-dream.policy';
import {
  BotMemoryDreamResponseDto,
  BotMemoryDreamStateResponseDto,
} from './dtos/bot-memory-dream.response.dto';

/** A bot's latest dream: its row, as the domain reads it, and as Settings → Memory shows it. */
@Injectable()
export class BotMemoryDreamMapper {
  toDomain(
    record: Pick<
      BotMemoryDreamOrmEntity,
      | 'id'
      | 'organizationId'
      | 'botId'
      | 'factsBefore'
      | 'factsAfter'
      | 'note'
      | 'createdAt'
      | 'undoneAt'
    >,
  ): StoredDream {
    return {
      id: record.id,
      organizationId: record.organizationId,
      botId: record.botId,
      factsBefore: record.factsBefore,
      factsAfter: record.factsAfter,
      note: record.note,
      createdAt: new Date(record.createdAt),
      undoneAt: record.undoneAt ? new Date(record.undoneAt) : null,
    };
  }

  /** A fact as the dream reads it. */
  toDreamFact(fact: BotMemoryFactEntity): DreamFact {
    return {
      id: fact.id,
      botId: fact.botId,
      content: fact.content,
      tier: fact.tier,
      scope: fact.scope,
      source: fact.source,
      createdAt: fact.createdAt,
      updatedAt: fact.updatedAt,
    };
  }

  toResponse(dream: StoredDream): BotMemoryDreamResponseDto {
    const dto = new BotMemoryDreamResponseDto();
    const shape: BotMemoryDream = {
      id: dream.id,
      factsBefore: dream.factsBefore,
      factsAfter: dream.factsAfter,
      note: dream.note,
      createdAt: dream.createdAt.toISOString(),
      undoneAt: dream.undoneAt?.toISOString() ?? null,
    };
    return Object.assign(dto, shape);
  }

  toState(dream: StoredDream | null): BotMemoryDreamStateResponseDto {
    const dto = new BotMemoryDreamStateResponseDto();
    dto.latest = dream ? this.toResponse(dream) : null;
    return dto;
  }
}
