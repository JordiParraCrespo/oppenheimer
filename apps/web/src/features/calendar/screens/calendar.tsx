import { EventDialog } from '../dialogs/event';
import { GoogleEventDialog } from '../dialogs/google-event';
import { useCalendarView } from '../hooks/use-calendar-view';
import { AgendaGrid } from '../sections/agenda-grid';
import { CalendarHeader } from '../sections/calendar-header';
import { MonthGrid } from '../sections/month-grid';

/**
 * Plan's calendar (`product/versions/mvp/20-plan-calendar.md`): the header,
 * the view the address names (a day or a week on the hours, or the month),
 * and the event dialogs the address opens: a personal event's, and a Google
 * event's read-only view.
 */
export function CalendarScreen() {
  const { view } = useCalendarView();
  return (
    <div className="flex flex-col gap-5">
      <CalendarHeader />
      {view === 'month' ? <MonthGrid /> : <AgendaGrid />}
      <EventDialog />
      <GoogleEventDialog />
    </div>
  );
}
