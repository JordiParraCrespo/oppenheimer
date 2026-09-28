import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { ApiTokensRepository } from './api-tokens.repository';

export const ApiTokensModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.ApiTokensRepository).to(ApiTokensRepository).inSingletonScope();
});
