import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { AutomationsRepository } from './automations.repository';
import { AutomationsService } from './automations.service';

export const AutomationsModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.AutomationsRepository).to(AutomationsRepository).inSingletonScope();
  bind(TOKENS.AutomationsService).to(AutomationsService).inSingletonScope();
});
