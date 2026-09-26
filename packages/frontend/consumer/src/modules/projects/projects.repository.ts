import {
  type CreateProjectRequest,
  heyApiSdk,
  type ProjectResponseDto,
  type UpdateProjectRequest,
} from '@oppenheimer/api-client';
import { AppError, MapApiError } from '@oppenheimer/frontend-core';
import { isCodingAgentId } from '@oppenheimer/shared/agents';
import { injectable } from 'inversify';
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
    data.originGithubRepoId ?? null,
    data.defaultHostId ?? null,
    isCodingAgentId(data.defaultAgent) ? data.defaultAgent : null,
    data.repositories.map((repository) => ({
      id: repository.id,
      installationId: repository.installationId,
      // The API sends a bigint as a string; the console compares it with the
      // ids the installation listing serves, which are numbers.
      githubRepoId: Number(repository.githubRepoId),
      fullName: repository.fullName,
      isDefault: repository.isDefault,
      baseBranch: repository.baseBranch ?? null,
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
    ...(row.baseBranch ? { baseBranch: row.baseBranch } : {}),
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
    // The generated type drops the schema's `null` for an enum; the API takes
    // it, and null is how a default agent is cleared.
    ...(input.defaultAgent !== undefined
      ? { defaultAgent: input.defaultAgent as UpdateProjectRequest['defaultAgent'] }
      : {}),
  };
}

@injectable()
export class ProjectsRepository {
  @MapApiError(ProjectsErrors.FETCH_LIST_FAILED)
  async findAll(): Promise<ProjectEntity[]> {
    const { data, error } = await heyApiSdk.listProjects();
    // An absent body is a failed read, not an empty collection — returning `[]`
    // would render "no projects" over a request that never succeeded.
    if (error || !data) throw new AppError(ProjectsErrors.FETCH_LIST_FAILED);
    return data.map(toEntity);
  }

  @MapApiError(ProjectsErrors.CREATE_FAILED)
  async create(input: CreateProjectInput): Promise<ProjectEntity> {
    const { data, error } = await heyApiSdk.createProject({ body: toCreateRequest(input) });
    if (error || !data) throw new AppError(ProjectsErrors.CREATE_FAILED);
    return toEntity(data);
  }

  @MapApiError(ProjectsErrors.UPDATE_FAILED)
  async update(id: string, input: UpdateProjectInput): Promise<ProjectEntity> {
    const { data, error } = await heyApiSdk.updateProject({
      path: { id },
      body: toUpdateRequest(input),
    });
    if (error || !data) throw new AppError(ProjectsErrors.UPDATE_FAILED);
    return toEntity(data);
  }

  @MapApiError(ProjectsErrors.ARCHIVE_FAILED)
  async archive(id: string): Promise<ProjectEntity> {
    const { data, error } = await heyApiSdk.archiveProject({ path: { id } });
    if (error || !data) throw new AppError(ProjectsErrors.ARCHIVE_FAILED);
    return toEntity(data);
  }
}
