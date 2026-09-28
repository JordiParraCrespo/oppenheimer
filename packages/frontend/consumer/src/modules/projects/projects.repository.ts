import {
  type CreateProjectRequest,
  heyApiSdk,
  type ProjectResponseDto,
  type UpdateProjectRequest,
} from '@oppenheimer/api-client';
import { MapApiError, unwrapBody } from '@oppenheimer/frontend-core';
import { isCodingAgentId } from '@oppenheimer/shared/agents';
import { injectable } from 'inversify';
import { repositoryKey } from '../installations/repository-key';
import {
  type CreateProjectInput,
  ProjectEntity,
  type ProjectRepositoryInput,
  type UpdateProjectInput,
} from './project.entity';
import { ProjectsErrors } from './projects.errors';

function toEntity(data: ProjectResponseDto): ProjectEntity {
  return new ProjectEntity(
    data.id,
    data.name,
    data.slug,
    data.isUnassigned,
    data.defaultHostId ?? null,
    isCodingAgentId(data.defaultAgent) ? data.defaultAgent : null,
    data.repositories.map((repository) => ({
      id: repositoryKey({
        installationId: repository.installationId,
        githubRepoId: Number(repository.githubRepoId),
      }),
      installationId: repository.installationId,
      githubRepoId: repository.githubRepoId,
      fullName: repository.repositoryFullName,
      isDefault: repository.isDefault,
      baseBranch: repository.baseBranch,
    })),
    new Date(data.createdAt),
    new Date(data.updatedAt),
  );
}

function toRepositoryRows(rows: ProjectRepositoryInput[]): CreateProjectRequest['repositories'] {
  return rows.map((row) => ({
    installationId: row.installationId,
    githubRepoId: row.githubRepoId,
    isDefault: row.isDefault,
    baseBranch: row.baseBranch,
  }));
}

function toCreateRequest(input: CreateProjectInput): CreateProjectRequest {
  return {
    name: input.name,
    repositories: toRepositoryRows(input.repositories),
    ...(input.defaultHostId ? { defaultHostId: input.defaultHostId } : {}),
    ...(input.defaultAgent ? { defaultAgent: input.defaultAgent } : {}),
  };
}

function toUpdateRequest(input: UpdateProjectInput): UpdateProjectRequest {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.repositories !== undefined
      ? { repositories: toRepositoryRows(input.repositories) }
      : {}),
    ...(input.defaultHostId !== undefined ? { defaultHostId: input.defaultHostId } : {}),
    // null is how a default agent is cleared.
    ...(input.defaultAgent !== undefined ? { defaultAgent: input.defaultAgent } : {}),
  };
}

@injectable()
export class ProjectsRepository {
  @MapApiError(ProjectsErrors.FETCH_LIST_FAILED)
  async findAll(): Promise<ProjectEntity[]> {
    // An absent body is a failed read, not an empty collection — returning `[]`
    // would render "no projects" over a request that never succeeded.
    const data = await unwrapBody(heyApiSdk.findProjects(), ProjectsErrors.FETCH_LIST_FAILED);
    return data.map(toEntity);
  }

  @MapApiError(ProjectsErrors.CREATE_FAILED)
  async create(input: CreateProjectInput): Promise<ProjectEntity> {
    const data = await unwrapBody(
      heyApiSdk.createProject({ body: toCreateRequest(input) }),
      ProjectsErrors.CREATE_FAILED,
    );
    return toEntity(data);
  }

  @MapApiError(ProjectsErrors.UPDATE_FAILED)
  async update(id: string, input: UpdateProjectInput): Promise<ProjectEntity> {
    const data = await unwrapBody(
      heyApiSdk.updateProject({
        path: { id },
        body: toUpdateRequest(input),
      }),
      ProjectsErrors.UPDATE_FAILED,
    );
    return toEntity(data);
  }

  @MapApiError(ProjectsErrors.ARCHIVE_FAILED)
  async archive(id: string): Promise<ProjectEntity> {
    const data = await unwrapBody(
      heyApiSdk.archiveProject({ path: { id } }),
      ProjectsErrors.ARCHIVE_FAILED,
    );
    return toEntity(data);
  }
}
