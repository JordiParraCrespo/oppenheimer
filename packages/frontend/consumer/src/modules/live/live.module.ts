import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { LiveService } from './live.service';

export const LiveModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.LiveService).to(LiveService).inSingletonScope();
});
