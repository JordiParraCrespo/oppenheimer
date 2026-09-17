import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { AdminUsersRepository } from './admin-users.repository';
import { AdminUsersService } from './admin-users.service';

export const AdminUsersModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.AdminUsersRepository).to(AdminUsersRepository).inSingletonScope();
  bind(TOKENS.AdminUsersService).to(AdminUsersService).inSingletonScope();
});
