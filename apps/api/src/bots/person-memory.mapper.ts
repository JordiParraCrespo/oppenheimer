import { Injectable } from '@nestjs/common';
import { BotMemoryFactMapper } from './bot-memory-fact.mapper';
import { PersonMemoryOrmEntity } from './database/person-memory.orm-entity';
import type { PersonAbout } from './domain/bot.types';
import { PersonAboutResponseDto, PersonMemoryResponseDto } from './dtos/person-memory.response.dto';
import type { PersonMemory } from './queries/find-person-memory/find-person-memory.query';

@Injectable()
export class PersonMemoryMapper {
  private readonly facts = new BotMemoryFactMapper();

  toDomain(record: PersonMemoryOrmEntity): PersonAbout {
    return {
      organizationId: record.organizationId,
      userId: record.userId,
      about: record.about,
      updatedAt: new Date(record.updatedAt),
    };
  }

  toResponse(about: PersonAbout): PersonAboutResponseDto {
    const dto = new PersonAboutResponseDto();
    dto.about = about.about;
    dto.updatedAt = about.updatedAt?.toISOString() ?? null;
    return dto;
  }

  /** `GET /bot-memory/person`: the person's text and every fact about them, each as its bot keeps it. */
  toMemoryResponse(memory: PersonMemory): PersonMemoryResponseDto {
    const dto = new PersonMemoryResponseDto();
    dto.about = this.toResponse(memory.about);
    dto.facts = memory.facts.map((fact) => this.facts.toResponse(fact));
    return dto;
  }
}
