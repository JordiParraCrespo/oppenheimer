import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { GoalOrmEntity } from './database/goal.orm-entity';
import { GoalEntity } from './domain/goal.entity';
import { GoalResponseDto } from './dtos/goal.response.dto';

/** How far a goal is: its tasks, and those of them Done. Read by the query, never stored. */
export interface GoalProgress {
  done: number;
  total: number;
}

@Injectable()
export class GoalMapper implements Mapper<GoalEntity, GoalOrmEntity, GoalResponseDto> {
  toPersistence(entity: GoalEntity): GoalOrmEntity {
    const record = new GoalOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.projectId = entity.projectId;
    record.name = entity.name;
    record.targetDate = entity.targetDate;
    record.createdByUserId = entity.createdByUserId;
    return record;
  }

  toDomain(record: GoalOrmEntity): GoalEntity {
    return GoalEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        projectId: record.projectId,
        name: record.name,
        targetDate: record.targetDate ?? null,
        createdByUserId: record.createdByUserId ?? null,
      },
    });
  }

  toResponse(entity: GoalEntity, progress: GoalProgress = { done: 0, total: 0 }): GoalResponseDto {
    const dto = new GoalResponseDto();
    dto.id = entity.id;
    dto.projectId = entity.projectId;
    dto.name = entity.name;
    dto.targetDate = entity.targetDate;
    dto.doneCount = progress.done;
    dto.totalCount = progress.total;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}
