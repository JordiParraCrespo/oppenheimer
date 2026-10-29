import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { MailRepository } from './mail.repository';

export const MailModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.MailRepository).to(MailRepository).inSingletonScope();
});
