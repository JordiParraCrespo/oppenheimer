import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { ProjectOrmEntity } from './database/project.orm-entity';
import { ProjectEntity } from './domain/project.entity';
import { ProjectResponseDto } from './dtos/project.response.dto';

/** Maps the project aggregate between its domain, persistence and response shapes. */
@Injectable()
export class ProjectMapper implements Mapper<ProjectEntity, ProjectOrmEntity, ProjectResponseDto> {
  toPersistence(entity: ProjectEntity): ProjectOrmEntity {
    const record = new ProjectOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.name = entity.name;
    record.slug = entity.slug;
    // `originGithubRepoId` is a bigint column, which the driver exchanges as a
    // string; GitHub's ids are well inside the safe integer range on the way in.
    record.originGithubRepoId =
      entity.originGithubRepoId === null ? null : String(entity.originGithubRepoId);
    record.archivedAt = entity.archivedAt;
    return record;
  }

  toDomain(record: ProjectOrmEntity): ProjectEntity {
    return ProjectEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        name: record.name,
        slug: record.slug,
        originGithubRepoId:
          record.originGithubRepoId === null ? null : Number(record.originGithubRepoId),
        archivedAt: record.archivedAt,
      },
    });
  }

  toResponse(entity: ProjectEntity): ProjectResponseDto {
    const dto = new ProjectResponseDto();
    dto.id = entity.id;
    dto.organizationId = entity.organizationId;
    dto.name = entity.name;
    dto.slug = entity.slug;
    dto.originGithubRepoId = entity.originGithubRepoId;
    dto.archivedAt = entity.archivedAt;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
