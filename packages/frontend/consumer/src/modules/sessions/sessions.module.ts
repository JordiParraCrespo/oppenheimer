import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { SessionsRepository } from './sessions.repository';
import { SessionsService } from './sessions.service';

export const SessionsModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.SessionsRepository).to(SessionsRepository).inSingletonScope();
  bind(TOKENS.SessionsService).to(SessionsService).inSingletonScope();
});
