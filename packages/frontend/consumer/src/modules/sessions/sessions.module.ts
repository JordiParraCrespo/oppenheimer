import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { SessionsRepository } from './sessions.repository';
import { SessionsService } from './sessions.service';
import type { LocalTerminals } from './stream/local-first-stream';

export const SessionsModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.SessionsRepository).to(SessionsRepository).inSingletonScope();
  bind(TOKENS.SessionsService).to(SessionsService).inSingletonScope();
});

/**
 * Binds the shell's way to this machine's terminals. A platform that has one
 * (the desktop app's preload) loads this beside the consumer modules.
 */
export function localTerminalsModule(terminals: LocalTerminals): ContainerModule {
  return new ContainerModule(({ bind }) => {
    bind<LocalTerminals>(TOKENS.LocalTerminals).toConstantValue(terminals);
  });
}
