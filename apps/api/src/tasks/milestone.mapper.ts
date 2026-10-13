import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import type { PlanSummaryMilestone } from '@oppenheimer/shared/plan';
import { MilestoneOrmEntity } from './database/milestone.orm-entity';
import { MilestoneEntity } from './domain/milestone.entity';
import { MilestoneResponseDto } from './dtos/milestone.response.dto';

/** How far a milestone is: its tasks, and those of them Done. Read by the query, never stored. */
export interface MilestoneProgress {
  done: number;
  total: number;
}

@Injectable()
export class MilestoneMapper
  implements Mapper<MilestoneEntity, MilestoneOrmEntity, MilestoneResponseDto>
{
  toPersistence(entity: MilestoneEntity): MilestoneOrmEntity {
    const record = new MilestoneOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.projectId = entity.projectId;
    record.name = entity.name;
    record.targetDate = entity.targetDate;
    record.createdByUserId = entity.createdByUserId;
    record.version = entity.version;
    record.idempotencyKey = entity.idempotencyKey;
    return record;
  }

  toDomain(record: MilestoneOrmEntity): MilestoneEntity {
    return MilestoneEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        projectId: record.projectId,
        name: record.name,
        targetDate: record.targetDate ?? null,
        createdByUserId: record.createdByUserId ?? null,
        version: record.version,
        idempotencyKey: record.idempotencyKey ?? null,
      },
    });
  }

  toResponse(
    entity: MilestoneEntity,
    progress: MilestoneProgress = { done: 0, total: 0 },
  ): MilestoneResponseDto {
    const dto = new MilestoneResponseDto();
    dto.id = entity.id;
    dto.projectId = entity.projectId;
    dto.name = entity.name;
    dto.targetDate = entity.targetDate;
    dto.doneCount = progress.done;
    dto.totalCount = progress.total;
    dto.version = entity.version;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }

  /** What `summarizePlan` reads of a milestone. */
  toSummaryMilestone(entity: MilestoneEntity): PlanSummaryMilestone {
    return {
      id: entity.id,
      projectId: entity.projectId,
      name: entity.name,
      targetDate: entity.targetDate,
    };
  }
}
