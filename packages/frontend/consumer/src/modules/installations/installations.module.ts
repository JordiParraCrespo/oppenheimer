import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { InstallationsRepository } from './installations.repository';

export const InstallationsModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.InstallationsRepository).to(InstallationsRepository).inSingletonScope();
});
