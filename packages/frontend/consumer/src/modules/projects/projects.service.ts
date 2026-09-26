import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type { CreateProjectInput, ProjectEntity, UpdateProjectInput } from './project.entity';
import type { ProjectsRepository } from './projects.repository';

@injectable()
export class ProjectsService {
  constructor(
    @inject(TOKENS.ProjectsRepository)
    private readonly repository: ProjectsRepository,
  ) {}

  findAll(): Promise<ProjectEntity[]> {
    return this.repository.findAll();
  }

  create(input: CreateProjectInput): Promise<ProjectEntity> {
    return this.repository.create(input);
  }

  update(id: string, input: UpdateProjectInput): Promise<ProjectEntity> {
    return this.repository.update(id, input);
  }

  archive(id: string): Promise<ProjectEntity> {
    return this.repository.archive(id);
  }
}
