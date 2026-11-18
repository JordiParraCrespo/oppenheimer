import { createFileRoute } from '@tanstack/react-router';
import { calendarSearchSchema } from '@/features/calendar/lib/calendar-search';
import { CalendarScreen } from '@/features/calendar/screens/calendar';

/**
 * Plan's calendar: `?month=` the month shown, `?off=` the layers switched
 * off, `?project=` the projects its tasks and runs are narrowed to, `?status=` and
 * `?origin=` the tasks' statuses and who added them, `?event=` the event dialog (with `?day=` for a new one), `?google=`
 * a Google event's read-only view.
 */
export const Route = createFileRoute('/_authenticated/plan/calendar')({
  validateSearch: calendarSearchSchema,
  component: CalendarScreen,
});
