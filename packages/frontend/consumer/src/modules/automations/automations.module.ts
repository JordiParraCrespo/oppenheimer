import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { AutomationsRepository } from './automations.repository';

export const AutomationsModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.AutomationsRepository).to(AutomationsRepository).inSingletonScope();
});
