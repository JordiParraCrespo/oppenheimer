import { createFileRoute } from '@tanstack/react-router';
import { googleReturnSearchSchema } from '@/features/calendar/lib/google-return-search';
import { GoogleCalendarReturnScreen } from '@/features/calendar/screens/google-calendar-return';

/**
 * Where Google's consent screen sends the browser back
 * (`CALENDAR_GOOGLE_*` in `.env.example`: the redirect URI is
 * `${FRONTEND_URL}/plan/calendar/google`). Un-nested from the calendar, which
 * renders no outlet. A status column, not Plan's board: the `status`
 * measure, centred in the pane.
 */
export const Route = createFileRoute('/_authenticated/plan/calendar_/google')({
  validateSearch: googleReturnSearchSchema,
  component: GoogleCalendarReturnScreen,
  staticData: { pane: 'status' },
});
