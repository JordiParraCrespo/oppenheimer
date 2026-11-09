import { MonthCalendar } from '@oppenheimer/design-system-web';
import { useLocale } from '@oppenheimer/frontend-web';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useCalendarView } from '../hooks/use-calendar-view';
import { NEW_EVENT } from '../lib/calendar-search';
import { monthMove } from '../lib/calendar-view';
import { CalendarSurface } from './calendar-surface';

const calendar = getRouteApi('/_authenticated/plan/calendar');

/**
 * The month (`20-plan-calendar.md` §2) on the design system's calendar: a
 * personal event or a task dragged onto another day moves there
 * (`monthMove`); empty space on a day opens New event; a day's number opens
 * that day on the hours.
 */
export function MonthGrid() {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = calendar.useNavigate();
  const { month, today } = useCalendarView();
  const [year, monthNumber] = month.split('-').map(Number);

  return (
    <CalendarSurface move={monthMove}>
      {(entries, open) => (
        <MonthCalendar
          year={year}
          month={monthNumber - 1}
          entries={entries}
          today={today}
          locale={locale}
          onOpenEntry={open}
          onAddDay={(day) =>
            navigate({ search: (previous) => ({ ...previous, event: NEW_EVENT, day }) })
          }
          onOpenDay={(date) =>
            navigate({
              search: (previous) => ({
                ...previous,
                view: undefined,
                month: undefined,
                date: date === today ? undefined : date,
              }),
            })
          }
          moreLabel={(count) => t('calendar.grid.more', { count })}
          closeLabel={t('common.close')}
        />
      )}
    </CalendarSurface>
  );
}
