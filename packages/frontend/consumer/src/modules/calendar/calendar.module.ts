import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { CalendarRepository } from './calendar.repository';

export const CalendarModule = new ContainerModule(({ bind }) => {
  bind(TOKENS.CalendarRepository).to(CalendarRepository).inSingletonScope();
});
