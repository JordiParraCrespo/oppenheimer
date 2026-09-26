import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { ProjectsRepository } from './projects.repository';
import { ProjectsService } from './projects.service';

export const ProjectsModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.ProjectsRepository).to(ProjectsRepository).inSingletonScope();
  bind(TOKENS.ProjectsService).to(ProjectsService).inSingletonScope();
});
