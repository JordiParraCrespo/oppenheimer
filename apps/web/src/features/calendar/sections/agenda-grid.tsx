import { AgendaCalendar, agendaSlot, useNow } from '@oppenheimer/design-system-web';
import { useLocale } from '@oppenheimer/frontend-web';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useCalendarView } from '../hooks/use-calendar-view';
import { NEW_EVENT } from '../lib/calendar-search';
import { agendaMove } from '../lib/calendar-view';
import { CalendarSurface } from './calendar-surface';

const calendar = getRouteApi('/_authenticated/plan/calendar');

/**
 * Day and Week (the 2026-11-08 `Tasks` frame) on the design system's
 * agenda: timed items on the hours and the rest in All day. A personal
 * event or a task dragged onto a half hour moves there (`agendaMove`); an
 * empty half hour opens New event at that time; a day's head opens that day.
 */
export function AgendaGrid() {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = calendar.useNavigate();
  const { days, today } = useCalendarView();
  const clock = new Date(useNow(60_000));
  const now = `${String(clock.getHours()).padStart(2, '0')}:${String(clock.getMinutes()).padStart(2, '0')}`;

  return (
    <CalendarSurface move={(item, target) => agendaMove(item, agendaSlot(target))}>
      {(entries, open) => (
        <AgendaCalendar
          days={days}
          entries={entries}
          today={today}
          now={now}
          locale={locale}
          allDayLabel={t('calendar.grid.allDay')}
          onOpenEntry={open}
          onOpenDay={(date) =>
            navigate({
              search: (previous) => ({
                ...previous,
                view: undefined,
                date: date === today ? undefined : date,
              }),
            })
          }
          onAddSlot={(day, at) =>
            navigate({ search: (previous) => ({ ...previous, event: NEW_EVENT, day, at }) })
          }
        />
      )}
    </CalendarSurface>
  );
}
