import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { ProjectsRepository } from './projects.repository';

export const ProjectsModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.ProjectsRepository).to(ProjectsRepository).inSingletonScope();
});
