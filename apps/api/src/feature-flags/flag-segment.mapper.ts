import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { FlagSegmentOrmEntity } from './database/flag-segment.orm-entity';
import { FlagSegmentEntity } from './domain/flag-segment.entity';
import { FlagSegmentResponseDto } from './dtos/flag-segment.response.dto';

/** Maps the segment aggregate between its domain, persistence and response shapes. */
@Injectable()
export class FlagSegmentMapper
  implements Mapper<FlagSegmentEntity, FlagSegmentOrmEntity, FlagSegmentResponseDto>
{
  toPersistence(entity: FlagSegmentEntity): FlagSegmentOrmEntity {
    const record = new FlagSegmentOrmEntity();
    record.id = entity.id;
    record.key = entity.key;
    record.name = entity.name;
    record.description = entity.description;
    record.conditions = entity.conditions;
    record.updatedBy = entity.updatedBy;
    return record;
  }

  toDomain(record: FlagSegmentOrmEntity): FlagSegmentEntity {
    return FlagSegmentEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        key: record.key,
        name: record.name,
        description: record.description ?? null,
        conditions: record.conditions ?? [],
        updatedBy: record.updatedBy ?? null,
      },
    });
  }

  /** `usedBy` is the flags whose rules target it — the caller knows, the segment does not. */
  toResponse(entity: FlagSegmentEntity, usedBy: string[] = []): FlagSegmentResponseDto {
    const dto = new FlagSegmentResponseDto();
    dto.key = entity.key;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.conditions = entity.conditions;
    dto.usedBy = usedBy;
    dto.updatedBy = entity.updatedBy;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
