import { EventDialog } from '../dialogs/event';
import { CalendarHeader } from '../sections/calendar-header';
import { MonthGrid } from '../sections/month-grid';

/**
 * Plan's calendar (`product/versions/mvp/20-plan-calendar.md`): the month,
 * its header, and the event dialog the address opens.
 */
export function CalendarScreen() {
  return (
    <div className="flex flex-col gap-5">
      <CalendarHeader />
      <MonthGrid />
      <EventDialog />
    </div>
  );
}
