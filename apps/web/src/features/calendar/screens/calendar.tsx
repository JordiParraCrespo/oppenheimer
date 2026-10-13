import { EventDialog } from '../dialogs/event';
import { GoogleEventDialog } from '../dialogs/google-event';
import { CalendarHeader } from '../sections/calendar-header';
import { MonthGrid } from '../sections/month-grid';

/**
 * Plan's calendar (`product/versions/mvp/20-plan-calendar.md`): the month,
 * its header, and the event dialogs the address opens: a personal event's,
 * and a Google event's read-only view.
 */
export function CalendarScreen() {
  return (
    <div className="flex flex-col gap-5">
      <CalendarHeader />
      <MonthGrid />
      <EventDialog />
      <GoogleEventDialog />
    </div>
  );
}
