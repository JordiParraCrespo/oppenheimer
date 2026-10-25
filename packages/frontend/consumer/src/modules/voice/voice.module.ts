import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { VoiceRepository } from './voice.repository';

export const VoiceModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.VoiceRepository).to(VoiceRepository).inSingletonScope();
});
