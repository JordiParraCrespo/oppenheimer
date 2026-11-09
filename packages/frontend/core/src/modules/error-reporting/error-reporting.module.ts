import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { ErrorReportingService } from './error-reporting.service';

export const ErrorReportingModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.ErrorReportingService).to(ErrorReportingService).inSingletonScope();
});
