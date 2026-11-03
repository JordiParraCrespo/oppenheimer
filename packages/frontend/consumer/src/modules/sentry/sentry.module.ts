import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { SentryRepository } from './sentry.repository';

export const SentryModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.SentryRepository).to(SentryRepository).inSingletonScope();
});
