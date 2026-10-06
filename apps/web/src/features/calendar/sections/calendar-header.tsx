import { Button, IconButton } from '@oppenheimer/design-system-web';
import { ChevronLeft, ChevronRight, Plus } from '@oppenheimer/design-system-web/icons';
import { formatCalendarMonth, monthOf, shiftMonth, useLocale } from '@oppenheimer/frontend-web';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useMonth } from '../hooks/use-month';
import { NEW_EVENT } from '../lib/calendar-search';

const calendar = getRouteApi('/_authenticated/plan/calendar');

/** The month's name, previous / Today / next, and New event (`20-plan-calendar.md` §2). */
export function CalendarHeader() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { month, today } = useMonth();
  const navigate = calendar.useNavigate();
  const go = (next: string) =>
    navigate({
      search: (previous) => ({ ...previous, month: next === monthOf(today) ? undefined : next }),
      replace: true,
    });

  return (
    <header className="flex flex-wrap items-center gap-2">
      <h1 className="mr-auto text-h2 font-semibold tracking-tight capitalize">
        {formatCalendarMonth(month, locale)}
      </h1>
      <IconButton
        aria-label={t('calendar.header.previous')}
        onClick={() => go(shiftMonth(month, -1))}
      >
        <ChevronLeft />
      </IconButton>
      <Button variant="outline" size="sm" onClick={() => go(monthOf(today))}>
        {t('calendar.header.today')}
      </Button>
      <IconButton aria-label={t('calendar.header.next')} onClick={() => go(shiftMonth(month, 1))}>
        <ChevronRight />
      </IconButton>
      <Button
        className="ml-2"
        onClick={() =>
          navigate({ search: (previous) => ({ ...previous, event: NEW_EVENT, day: today }) })
        }
      >
        <Plus />
        {t('calendar.header.newEvent')}
      </Button>
    </header>
  );
}
