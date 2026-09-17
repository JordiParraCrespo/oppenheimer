import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { ApiTokensRepository } from './api-tokens.repository';
import { ApiTokensService } from './api-tokens.service';

export const ApiTokensModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.ApiTokensRepository).to(ApiTokensRepository).inSingletonScope();
  bind(TOKENS.ApiTokensService).to(ApiTokensService).inSingletonScope();
});
