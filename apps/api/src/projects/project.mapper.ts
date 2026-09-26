import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { ProjectOrmEntity } from './database/project.orm-entity';
import { ProjectRepositoryOrmEntity } from './database/project-repository.orm-entity';
import { ProjectEntity } from './domain/project.entity';
import { ProjectRepositoryResponseDto, ProjectResponseDto } from './dtos/project.response.dto';

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
    record.createdByUserId = entity.createdByUserId;
    record.defaultHostId = entity.defaultHostId;
    record.defaultAgent = entity.defaultAgent;
    record.instructions = entity.instructions;
    return record;
  }

  /** The repository rows for a project, in the order it holds them. */
  toRepositoryRecords(entity: ProjectEntity): ProjectRepositoryOrmEntity[] {
    return entity.repositories.map((repository, position) => {
      const record = new ProjectRepositoryOrmEntity();
      record.organizationId = entity.organizationId;
      record.projectId = entity.id;
      record.installationId = repository.installationId;
      record.githubRepoId = repository.githubRepoId;
      record.repositoryFullName = repository.repositoryFullName;
      record.baseBranch = repository.baseBranch;
      record.isDefault = repository.isDefault;
      record.position = position;
      return record;
    });
  }

  /**
   * `repositories` are the project's child rows, read by the project id the
   * scoped read already verified; they are ordered here, so a caller cannot hand
   * them over in the wrong order.
   */
  toDomain(
    record: ProjectOrmEntity,
    repositories: ProjectRepositoryOrmEntity[] = [],
  ): ProjectEntity {
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
        createdByUserId: record.createdByUserId ?? null,
        defaultHostId: record.defaultHostId ?? null,
        defaultAgent: record.defaultAgent ?? null,
        instructions: record.instructions ?? '',
        repositories: [...repositories]
          .sort((a, b) => a.position - b.position)
          .map((repository) => ({
            installationId: repository.installationId,
            githubRepoId: String(repository.githubRepoId),
            repositoryFullName: repository.repositoryFullName,
            baseBranch: repository.baseBranch,
            isDefault: repository.isDefault,
          })),
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
    dto.repositories = entity.repositories.map((repository) => {
      const item = new ProjectRepositoryResponseDto();
      item.installationId = repository.installationId;
      item.githubRepoId = repository.githubRepoId;
      item.repositoryFullName = repository.repositoryFullName;
      item.baseBranch = repository.baseBranch;
      item.isDefault = repository.isDefault;
      return item;
    });
    dto.defaultHostId = entity.defaultHostId;
    dto.defaultAgent = entity.defaultAgent;
    dto.instructions = entity.instructions;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
