import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { createAuthStore } from './auth.state';

export const AuthModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.AuthStore).toConstantValue(createAuthStore());
  bind(TOKENS.AuthRepository).to(AuthRepository).inSingletonScope();
  bind(TOKENS.AuthService).to(AuthService).inSingletonScope();
});
