import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { InboxRepository } from './inbox.repository';

export const InboxModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.InboxRepository).to(InboxRepository).inSingletonScope();
});
