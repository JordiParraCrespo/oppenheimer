import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { TasksRepository } from './tasks.repository';

export const TasksModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.TasksRepository).to(TasksRepository).inSingletonScope();
});
