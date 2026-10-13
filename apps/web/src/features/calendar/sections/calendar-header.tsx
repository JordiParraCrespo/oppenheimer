import {
  Button,
  IconButton,
  PageHeader,
  PageHeaderMeta,
  PageHeaderRow,
  PageHeaderSep,
  PageHeaderStat,
} from '@oppenheimer/design-system-web';
import { ChevronLeft, ChevronRight, Plus } from '@oppenheimer/design-system-web/icons';
import { formatCalendarMonth, monthOf, shiftMonth, useLocale } from '@oppenheimer/frontend-web';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useMonth } from '../hooks/use-month';
import { useMonthCounts } from '../hooks/use-month-counts';
import { NEW_EVENT } from '../lib/calendar-search';

const calendar = getRouteApi('/_authenticated/plan/calendar');

/** "octubre de 2026" reads "Octubre de 2026" as a title. */
const capitalized = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/**
 * The calendar's header (the 2026-10-13 `Tasks` frame): the month's name, its
 * meetings, tasks due and automation runs, then Today, previous / next and New
 * event.
 */
export function CalendarHeader() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { month, today } = useMonth();
  const counts = useMonthCounts();
  const navigate = calendar.useNavigate();
  const go = (next: string) =>
    navigate({
      search: (previous) => ({ ...previous, month: next === monthOf(today) ? undefined : next }),
      replace: true,
    });

  return (
    <PageHeader>
      <PageHeaderRow
        size="display"
        meta={
          counts ? (
            <PageHeaderMeta indent={false}>
              <PageHeaderStat value={counts.meetings}>
                {t('calendar.header.meetings')}
              </PageHeaderStat>
              <PageHeaderSep />
              <PageHeaderStat value={counts.due}>{t('calendar.header.tasksDue')}</PageHeaderStat>
              <PageHeaderSep />
              <PageHeaderStat value={counts.runs}>{t('calendar.header.runs')}</PageHeaderStat>
            </PageHeaderMeta>
          ) : null
        }
        title={capitalized(formatCalendarMonth(month, locale))}
        actions={
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="sm" onClick={() => go(monthOf(today))}>
              {t('calendar.header.today')}
            </Button>
            <IconButton
              size="sm"
              aria-label={t('calendar.header.previous')}
              onClick={() => go(shiftMonth(month, -1))}
            >
              <ChevronLeft />
            </IconButton>
            <IconButton
              size="sm"
              aria-label={t('calendar.header.next')}
              onClick={() => go(shiftMonth(month, 1))}
            >
              <ChevronRight />
            </IconButton>
            <Button
              className="ml-3"
              onClick={() =>
                navigate({ search: (previous) => ({ ...previous, event: NEW_EVENT, day: today }) })
              }
            >
              <Plus />
              {t('calendar.header.newEvent')}
            </Button>
          </div>
        }
      />
    </PageHeader>
  );
}
