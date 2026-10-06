import { createFileRoute } from '@tanstack/react-router';
import { calendarSearchSchema } from '@/features/calendar/lib/calendar-search';
import { CalendarScreen } from '@/features/calendar/screens/calendar';

/**
 * Plan's calendar (`product/versions/mvp/20-plan-calendar.md`): `?month=`
 * the month shown, `?off=` the layers switched off, `?event=` the event
 * dialog (with `?day=` for a new one).
 */
export const Route = createFileRoute('/_authenticated/plan/calendar')({
  validateSearch: calendarSearchSchema,
  component: CalendarScreen,
});
