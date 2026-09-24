import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { FeatureFlagsRepository } from './feature-flags.repository';
import { FeatureFlagsService } from './feature-flags.service';

export const FeatureFlagsModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.FeatureFlagsRepository).to(FeatureFlagsRepository).inSingletonScope();
  bind(TOKENS.FeatureFlagsService).to(FeatureFlagsService).inSingletonScope();
});
