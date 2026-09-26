import { heyApiSdk, type ProjectResponseDto } from '@oppenheimer/api-client';
import { AppError, MapApiError } from '@oppenheimer/frontend-core';
import { injectable } from 'inversify';
import { ProjectEntity, type ProjectInput } from './project.entity';
import { ProjectsErrors } from './projects.errors';

function toEntity(data: ProjectResponseDto): ProjectEntity {
  return new ProjectEntity(
    data.id,
    data.name,
    data.slug,
    data.repositories.map((repository) => ({
      installationId: repository.installationId,
      githubRepoId: Number(repository.githubRepoId),
      repositoryFullName: repository.repositoryFullName,
      baseBranch: repository.baseBranch,
      isDefault: repository.isDefault,
    })),
    data.defaultHostId ?? null,
    data.defaultAgent ?? null,
    data.instructions,
    new Date(data.createdAt),
  );
}

/** The body both writes send: the repositories as a set, in the dialog's order. */
function toBody(input: ProjectInput) {
  return {
    name: input.name,
    repositories: input.repositories.map((repository) => ({
      installationId: repository.installationId,
      githubRepoId: repository.githubRepoId,
      baseBranch: repository.baseBranch,
      isDefault: repository.isDefault,
    })),
    defaultHostId: input.defaultHostId,
    defaultAgent: input.defaultAgent as ProjectBody['defaultAgent'],
    instructions: input.instructions,
  };
}

type ProjectBody = NonNullable<Parameters<typeof heyApiSdk.createProject>[0]>['body'];

@injectable()
export class ProjectsRepository {
  @MapApiError(ProjectsErrors.FETCH_LIST_FAILED)
  async findAll(): Promise<ProjectEntity[]> {
    const { data, error } = await heyApiSdk.listProjects();
    // An absent body is a failed read, not "no projects": an empty list would
    // send somebody to create a project they already have.
    if (error || !data) throw new AppError(ProjectsErrors.FETCH_LIST_FAILED);
    return data.map(toEntity);
  }

  @MapApiError(ProjectsErrors.CREATE_FAILED)
  async create(input: ProjectInput): Promise<ProjectEntity> {
    const { data, error } = await heyApiSdk.createProject({ body: toBody(input) });
    if (error || !data) throw new AppError(ProjectsErrors.CREATE_FAILED);
    return toEntity(data);
  }

  @MapApiError(ProjectsErrors.UPDATE_FAILED)
  async update(id: string, input: ProjectInput): Promise<ProjectEntity> {
    const { data, error } = await heyApiSdk.updateProject({ path: { id }, body: toBody(input) });
    if (error || !data) throw new AppError(ProjectsErrors.UPDATE_FAILED);
    return toEntity(data);
  }

  /** Archive: the API refuses while sessions nobody has closed are listed in it. */
  @MapApiError(ProjectsErrors.ARCHIVE_FAILED)
  async archive(id: string): Promise<void> {
    const { error } = await heyApiSdk.archiveProject({ path: { id } });
    if (error) throw new AppError(ProjectsErrors.ARCHIVE_FAILED);
  }
}
