import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { WhatsappRepository } from './whatsapp.repository';

export const WhatsappModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.WhatsappRepository).to(WhatsappRepository).inSingletonScope();
});
