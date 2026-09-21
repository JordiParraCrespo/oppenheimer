import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { InstallationsRepository } from './installations.repository';
import { InstallationsService } from './installations.service';

export const InstallationsModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.InstallationsRepository).to(InstallationsRepository).inSingletonScope();
  bind(TOKENS.InstallationsService).to(InstallationsService).inSingletonScope();
});
