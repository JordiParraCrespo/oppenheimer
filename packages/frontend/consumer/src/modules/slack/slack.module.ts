import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { SlackRepository } from './slack.repository';

export const SlackModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.SlackRepository).to(SlackRepository).inSingletonScope();
});
