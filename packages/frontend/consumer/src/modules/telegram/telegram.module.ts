import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { TelegramRepository } from './telegram.repository';

export const TelegramModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.TelegramRepository).to(TelegramRepository).inSingletonScope();
});
