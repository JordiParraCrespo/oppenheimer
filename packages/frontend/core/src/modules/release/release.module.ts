import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { ReleaseRepository } from './release.repository';
import { ReleaseService } from './release.service';

export const ReleaseModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.ReleaseRepository).to(ReleaseRepository).inSingletonScope();
  bind(TOKENS.ReleaseService).to(ReleaseService).inSingletonScope();
});
