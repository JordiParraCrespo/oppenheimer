import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { AnalyticsService } from './analytics.service';

export const AnalyticsModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.AnalyticsService).to(AnalyticsService).inSingletonScope();
});
