import { Injectable } from '@nestjs/common';
import { PersonMemoryOrmEntity } from './database/person-memory.orm-entity';
import type { PersonAbout } from './domain/bot.types';
import { PersonAboutResponseDto } from './dtos/person-memory.response.dto';

@Injectable()
export class PersonMemoryMapper {
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
}
