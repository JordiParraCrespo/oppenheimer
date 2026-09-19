import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { ProjectOrmEntity } from './database/project.orm-entity';
import { ProjectEntity } from './domain/project.entity';
import { ProjectResponseDto } from './dtos/project.response.dto';

/**
 * Maps the project aggregate between its domain, persistence and response shapes.
 *
 * `originGithubRepoId` crosses every boundary as the string the driver exchanges
 * a bigint as. Nothing coerces it: GitHub's ids fit in a JavaScript number today
 * and the column type says they are not promised to.
 */
@Injectable()
export class ProjectMapper implements Mapper<ProjectEntity, ProjectOrmEntity, ProjectResponseDto> {
  toPersistence(entity: ProjectEntity): ProjectOrmEntity {
    const record = new ProjectOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.name = entity.name;
    record.slug = entity.slug;
    record.originGithubRepoId = entity.originGithubRepoId;
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
        originGithubRepoId: record.originGithubRepoId,
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
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
