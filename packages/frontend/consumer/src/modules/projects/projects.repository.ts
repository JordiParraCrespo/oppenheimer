import {
  type CreateProjectRequest,
  heyApiSdk,
  type ProjectResponseDto,
  type UpdateProjectRequest,
} from '@oppenheimer/api-client';
import { callApi } from '@oppenheimer/frontend-core';
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
    ...(input.defaultAgent !== undefined ? { defaultAgent: input.defaultAgent } : {}),
  };
}

@injectable()
export class ProjectsRepository {
  findAll(): Promise<ProjectEntity[]> {
    return callApi(ProjectsErrors.FETCH_LIST_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findProjects());
      return data.map(toEntity);
    });
  }

  create(input: CreateProjectInput): Promise<ProjectEntity> {
    return callApi(ProjectsErrors.CREATE_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.createProject({ body: toCreateRequest(input) }));
      return toEntity(data);
    });
  }

  update(id: string, input: UpdateProjectInput): Promise<ProjectEntity> {
    return callApi(ProjectsErrors.UPDATE_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.updateProject({
          path: { id },
          body: toUpdateRequest(input),
        }),
      );
      return toEntity(data);
    });
  }

  archive(id: string): Promise<ProjectEntity> {
    return callApi(ProjectsErrors.ARCHIVE_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.archiveProject({ path: { id } }));
      return toEntity(data);
    });
  }
}
