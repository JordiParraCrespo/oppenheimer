import {
  Button,
  IconButton,
  PageHeader,
  PageHeaderMeta,
  PageHeaderRow,
  PageHeaderSep,
  PageHeaderStat,
  SegmentedControl,
  SegmentedControlItem,
} from '@oppenheimer/design-system-web';
import { ChevronLeft, ChevronRight, Plus } from '@oppenheimer/design-system-web/icons';
import { monthOf, useLocale } from '@oppenheimer/frontend-web';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useCalendarView } from '../hooks/use-calendar-view';
import { useViewCounts } from '../hooks/use-view-counts';
import { headerEyebrow, headerTitle } from '../lib/calendar-header';
import { NEW_EVENT } from '../lib/calendar-search';
import { CALENDAR_VIEWS, type CalendarView, step } from '../lib/calendar-view';

const calendar = getRouteApi('/_authenticated/plan/calendar');

/**
 * The calendar's header (the 2026-11-08 `Tasks` frame): an eyebrow with the
 * week (Today · Week 45 on today, Weeks 40–44 over a month), the day, the
 * week's span or the month as the title, the view's meetings, tasks due and
 * automation runs, then Day / Week / Month, Today, previous / next and New
 * event.
 */
export function CalendarHeader() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { view, anchor, month, today, range } = useCalendarView();
  const counts = useViewCounts();
  const navigate = calendar.useNavigate();
  const shown = { view, anchor, month, range, today };

  const at = (next: { view: CalendarView; date?: string; month?: string }) =>
    navigate({
      search: (previous) => ({
        ...previous,
        view: next.view === 'day' ? undefined : next.view,
        date: next.date === today ? undefined : next.date,
        month: next.month === monthOf(today) ? undefined : next.month,
      }),
      replace: true,
    });
  const eyebrow = headerEyebrow(shown);

  return (
    <PageHeader>
      <span className="eyebrow">{t(eyebrow.key, eyebrow.values)}</span>
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
        title={headerTitle(shown, locale)}
        actions={
          <div className="flex items-center gap-1.5">
            <SegmentedControl
              size="md"
              className="mr-2.5"
              aria-label={t('calendar.header.views')}
              value={view}
              onValueChange={(next) => {
                const picked = CALENDAR_VIEWS.find((name) => name === next) ?? 'day';
                at(
                  picked === 'month'
                    ? { view: picked, month: monthOf(anchor) }
                    : { view: picked, date: anchor },
                );
              }}
            >
              {CALENDAR_VIEWS.map((name) => (
                <SegmentedControlItem key={name} value={name}>
                  {t(`calendar.header.${name}`)}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
            <Button variant="secondary" size="sm" onClick={() => at({ view })}>
              {t('calendar.header.today')}
            </Button>
            <IconButton
              size="sm"
              aria-label={t('calendar.header.previous')}
              onClick={() => at({ view, ...step(view, { anchor, month }, -1) })}
            >
              <ChevronLeft />
            </IconButton>
            <IconButton
              size="sm"
              aria-label={t('calendar.header.next')}
              onClick={() => at({ view, ...step(view, { anchor, month }, 1) })}
            >
              <ChevronRight />
            </IconButton>
            <Button
              className="ml-3"
              onClick={() =>
                navigate({
                  search: (previous) => ({
                    ...previous,
                    event: NEW_EVENT,
                    day: view === 'month' ? today : anchor,
                  }),
                })
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
