import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { CloudAgentsRepository } from './cloud-agents.repository';

export const CloudAgentsModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.CloudAgentsRepository).to(CloudAgentsRepository).inSingletonScope();
});
