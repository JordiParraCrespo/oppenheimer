import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { UserSettingsRepository } from './user-settings.repository';
import { UserSettingsService } from './user-settings.service';

export const UserSettingsModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.UserSettingsRepository).to(UserSettingsRepository).inSingletonScope();
  bind(TOKENS.UserSettingsService).to(UserSettingsService).inSingletonScope();
});
