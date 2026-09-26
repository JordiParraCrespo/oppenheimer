import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { isCodingAgentId } from '@oppenheimer/shared/agents';
import { ProjectOrmEntity } from './database/project.orm-entity';
import { ProjectRepositoryOrmEntity } from './database/project-repository.orm-entity';
import { ProjectEntity } from './domain/project.entity';
import { ProjectRepositoryEntity } from './domain/project-repository.entity';
import { ProjectRepositoryResponseDto, ProjectResponseDto } from './dtos/project.response.dto';

@Injectable()
export class ProjectMapper implements Mapper<ProjectEntity, ProjectOrmEntity, ProjectResponseDto> {
  toPersistence(entity: ProjectEntity): ProjectOrmEntity {
    const record = new ProjectOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.name = entity.name;
    record.slug = entity.slug;
    record.originGithubRepoId = entity.originGithubRepoId;
    record.defaultHostId = entity.defaultHostId;
    record.defaultAgent = entity.defaultAgent;
    record.archivedAt = entity.archivedAt;
    return record;
  }

  /** The aggregate's repository rows, keyed to its id. */
  repositoriesToPersistence(entity: ProjectEntity): ProjectRepositoryOrmEntity[] {
    return entity.repositories.map((repository) =>
      this.repositoryToPersistence(entity.id, repository),
    );
  }

  repositoryToPersistence(
    projectId: string,
    repository: ProjectRepositoryEntity,
  ): ProjectRepositoryOrmEntity {
    const record = new ProjectRepositoryOrmEntity();
    record.id = repository.id;
    record.projectId = projectId;
    record.installationId = repository.installationId;
    record.githubRepoId = repository.githubRepoId;
    record.fullName = repository.fullName;
    record.isDefault = repository.isDefault;
    record.baseBranch = repository.baseBranch;
    return record;
  }

  /**
   * `repositories` are the project's own rows, loaded by the store beside the
   * project row: the two mappings declare no relation, so the store joins them.
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
        defaultHostId: record.defaultHostId ?? null,
        // A row written by a build that knew an agent this one does not is read as
        // no default rather than refused: the project is still usable, and the
        // composer falls back to its last choice.
        defaultAgent: isCodingAgentId(record.defaultAgent) ? record.defaultAgent : null,
        repositories: repositories
          .slice()
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map((repository) => this.repositoryToDomain(repository)),
        archivedAt: record.archivedAt,
      },
    });
  }

  repositoryToDomain(record: ProjectRepositoryOrmEntity): ProjectRepositoryEntity {
    return ProjectRepositoryEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.createdAt,
      props: {
        installationId: record.installationId,
        githubRepoId: record.githubRepoId,
        fullName: record.fullName,
        isDefault: record.isDefault,
        baseBranch: record.baseBranch,
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
    dto.defaultHostId = entity.defaultHostId;
    dto.defaultAgent = entity.defaultAgent;
    dto.repositories = entity.repositories.map((repository) => {
      const row = new ProjectRepositoryResponseDto();
      row.id = repository.id;
      row.installationId = repository.installationId;
      row.githubRepoId = repository.githubRepoId;
      row.fullName = repository.fullName;
      row.isDefault = repository.isDefault;
      row.baseBranch = repository.baseBranch;
      return row;
    });
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
