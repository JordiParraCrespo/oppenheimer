import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { PullRequestsRepository } from './pull-requests.repository';

export const PullRequestsModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.PullRequestsRepository).to(PullRequestsRepository).inSingletonScope();
});
