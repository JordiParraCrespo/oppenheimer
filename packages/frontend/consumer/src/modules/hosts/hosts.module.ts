import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { HostsRepository } from './hosts.repository';
import { HostsService } from './hosts.service';

export const HostsModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.HostsRepository).to(HostsRepository).inSingletonScope();
  bind(TOKENS.HostsService).to(HostsService).inSingletonScope();
});
