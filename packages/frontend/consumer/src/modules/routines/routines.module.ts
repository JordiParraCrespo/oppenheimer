import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { RoutinesRepository } from './routines.repository';
import { RoutinesService } from './routines.service';

export const RoutinesModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.RoutinesRepository).to(RoutinesRepository).inSingletonScope();
  bind(TOKENS.RoutinesService).to(RoutinesService).inSingletonScope();
});
