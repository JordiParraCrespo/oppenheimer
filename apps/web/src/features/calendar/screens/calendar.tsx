import { EventDialog } from '../dialogs/event';
import { CalendarHeader } from '../sections/calendar-header';
import { MonthGrid } from '../sections/month-grid';

/**
 * Plan's calendar (`product/versions/mvp/20-plan-calendar.md`): the month,
 * its header, and the event dialog the address opens.
 */
export function CalendarScreen() {
  return (
    // The pane is `full`, so the screen keeps its own scroll.
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-310 flex-col gap-5 px-4 py-7 sm:px-8">
        <CalendarHeader />
        <MonthGrid />
        <EventDialog />
      </div>
    </div>
  );
}
