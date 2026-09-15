import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import type { AppAbility } from '@oppenheimer/shared';
import { LeadOrmEntity } from './database/lead.orm-entity';
import { LeadEntity } from './domain/lead.entity';
import { LeadResponseDto } from './dtos/lead.response.dto';

/** Fields a caller may hold `read Lead` without being allowed to see. */
const FIELD_LEVEL = ['value', 'notes'] as const;

/** Maps the lead aggregate between its domain, persistence and response shapes. */
@Injectable()
export class LeadMapper implements Mapper<LeadEntity, LeadOrmEntity, LeadResponseDto> {
  toPersistence(entity: LeadEntity): LeadOrmEntity {
    const record = new LeadOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.teamId = entity.teamId;
    record.ownerId = entity.ownerId;
    record.name = entity.name;
    record.email = entity.email;
    // `value` is a bigint column, which the driver exchanges as a string.
    record.value = String(entity.value);
    record.notes = entity.notes;
    return record;
  }

  toDomain(record: LeadOrmEntity): LeadEntity {
    return LeadEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        teamId: record.teamId,
        ownerId: record.ownerId,
        name: record.name,
        email: record.email,
        value: Number(record.value ?? 0),
        notes: record.notes,
      },
    });
  }

  /**
   * Domain → response, honouring **field-level** permissions.
   *
   * The route guard answers "may you read leads"; it cannot answer "may you
   * read their value". Passing the ability here is what makes a
   * `{ action: 'read', subject: 'Lead', fields: ['value'], inverted: true }`
   * rule actually redact the column rather than merely describe an intention.
   */
  toResponse(entity: LeadEntity, ability?: AppAbility): LeadResponseDto {
    const dto = new LeadResponseDto();
    dto.id = entity.id;
    dto.organizationId = entity.organizationId;
    dto.teamId = entity.teamId;
    dto.ownerId = entity.ownerId;
    dto.name = entity.name;
    dto.email = entity.email;
    dto.value = entity.value;
    dto.notes = entity.notes;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;

    if (ability) {
      for (const field of FIELD_LEVEL) {
        if (ability.can('read', 'Lead', field)) continue;
        if (field === 'value') dto.value = 0;
        if (field === 'notes') dto.notes = null;
      }
    }

    return dto;
  }
}
