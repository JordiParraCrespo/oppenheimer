import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

export const UsersModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.UserRepository).to(UsersRepository).inSingletonScope();
  bind(TOKENS.UsersService).to(UsersService).inSingletonScope();
});
