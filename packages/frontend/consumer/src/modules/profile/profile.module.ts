import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { ProfileRepository } from './profile.repository';
import { ProfileService } from './profile.service';

export const ProfileModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.ProfileRepository).to(ProfileRepository).inSingletonScope();
  bind(TOKENS.ProfileService).to(ProfileService).inSingletonScope();
});
