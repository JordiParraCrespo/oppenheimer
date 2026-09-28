import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { HostsRepository } from './hosts.repository';

export const HostsModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.HostsRepository).to(HostsRepository).inSingletonScope();
});
