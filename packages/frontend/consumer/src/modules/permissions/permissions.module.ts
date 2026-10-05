import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { PermissionsRepository } from './permissions.repository';

export const PermissionsModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.PermissionsRepository).to(PermissionsRepository).inSingletonScope();
});
