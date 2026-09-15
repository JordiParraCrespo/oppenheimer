import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { RolesRepository } from './roles.repository';
import { RolesService } from './roles.service';

export const RolesModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.RolesRepository).to(RolesRepository).inSingletonScope();
  bind(TOKENS.RolesService).to(RolesService).inSingletonScope();
});
