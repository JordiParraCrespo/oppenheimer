import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { TaskOrmEntity } from './database/task.orm-entity';
import { TaskSessionOrmEntity } from './database/task-session.orm-entity';
import { TaskEntity, type TaskSessionLink } from './domain/task.entity';
import { TaskResponseDto, TaskSessionLinkResponseDto } from './dtos/task.response.dto';

@Injectable()
export class TaskMapper implements Mapper<TaskEntity, TaskOrmEntity, TaskResponseDto> {
  toPersistence(entity: TaskEntity): TaskOrmEntity {
    const record = new TaskOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.projectId = entity.projectId;
    record.goalId = entity.goalId;
    record.status = entity.status;
    record.rank = entity.rank;
    record.title = entity.title;
    record.notes = entity.notes;
    record.dueDate = entity.dueDate;
    record.dueTime = entity.dueTime;
    record.completedAt = entity.completedAt;
    record.createdByUserId = entity.createdByUserId;
    return record;
  }

  toLinkRecord(task: TaskEntity, link: TaskSessionLink): TaskSessionOrmEntity {
    const record = new TaskSessionOrmEntity();
    record.organizationId = task.organizationId;
    record.taskId = task.id;
    record.sessionId = link.sessionId;
    record.origin = link.origin;
    record.linkedByUserId = link.linkedByUserId;
    return record;
  }

  /** `links` are the task's own rows, read by the id the scoped read verified. */
  toDomain(record: TaskOrmEntity, links: TaskSessionOrmEntity[] = []): TaskEntity {
    return TaskEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        projectId: record.projectId,
        goalId: record.goalId ?? null,
        status: record.status,
        rank: record.rank,
        title: record.title,
        notes: record.notes ?? '',
        dueDate: record.dueDate ?? null,
        dueTime: record.dueTime ?? null,
        completedAt: record.completedAt ?? null,
        createdByUserId: record.createdByUserId ?? null,
        sessions: [...links]
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map((link) => ({
            sessionId: link.sessionId,
            origin: link.origin,
            linkedByUserId: link.linkedByUserId ?? null,
            linkedAt: link.createdAt,
          })),
      },
    });
  }

  toResponse(entity: TaskEntity): TaskResponseDto {
    const dto = new TaskResponseDto();
    dto.id = entity.id;
    dto.projectId = entity.projectId;
    dto.goalId = entity.goalId;
    dto.status = entity.status;
    dto.rank = entity.rank;
    dto.title = entity.title;
    dto.notes = entity.notes;
    dto.dueDate = entity.dueDate;
    dto.dueTime = entity.dueTime;
    dto.completedAt = entity.completedAt?.toISOString() ?? null;
    dto.sessions = entity.sessions.map((link) => {
      const item = new TaskSessionLinkResponseDto();
      item.sessionId = link.sessionId;
      item.origin = link.origin;
      item.linkedAt = link.linkedAt.toISOString();
      return item;
    });
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}
