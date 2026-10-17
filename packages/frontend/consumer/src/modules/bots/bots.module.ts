import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { BotsRepository } from './bots.repository';

export const BotsModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.BotsRepository).to(BotsRepository).inSingletonScope();
});
