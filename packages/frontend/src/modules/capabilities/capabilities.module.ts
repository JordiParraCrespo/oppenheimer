import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { CapabilitiesRepository } from './capabilities.repository';
import { CapabilitiesService } from './capabilities.service';

export const CapabilitiesModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.CapabilitiesRepository).to(CapabilitiesRepository).inSingletonScope();
  bind(TOKENS.CapabilitiesService).to(CapabilitiesService).inSingletonScope();
});
