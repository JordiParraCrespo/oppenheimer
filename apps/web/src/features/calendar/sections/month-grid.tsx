import { Skeleton } from '@oppenheimer/design-system-web';
import {
  useAutomations,
  useCalendarEvents,
  useGoogleCalendarConnection,
  useGoogleCalendarEvents,
  useTasks,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatCalendarDay, useLocale, weekdayNames } from '@oppenheimer/frontend-web';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { CalendarChip } from '../components/calendar-chip';
import { DayCell } from '../components/day-cell';
import { useMonth } from '../hooks/use-month';
import {
  automationItems,
  byDay,
  type CalendarItem,
  eventItems,
  taskItems,
} from '../lib/calendar-items';
import { hiddenLayers, NEW_EVENT } from '../lib/calendar-search';

const calendar = getRouteApi('/_authenticated/plan/calendar');

/**
 * The month (`20-plan-calendar.md` §2): whole weeks, Monday first, each day
 * with the items of the layers that are on — personal events, Google's, tasks
 * due, scheduled automation runs. A personal event opens its dialog, a task
 * its card on the board, an automation its page, a Google event Google.
 */
export function MonthGrid() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { off } = calendar.useSearch();
  const navigate = calendar.useNavigate();
  const go = useNavigate();
  const { month, today, days, range } = useMonth();
  const hidden = hiddenLayers(off);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const events = useCalendarEvents(range);
  const connection = useGoogleCalendarConnection();
  const google = useGoogleCalendarEvents(
    range,
    timeZone,
    hidden.has('google') ? undefined : connection.data,
  );
  const { data: tasks } = useTasks({ select: (rows) => taskItems(rows, range.from, range.to) });
  const { data: automations } = useAutomations({
    select: (rows) => automationItems(rows, range.from, range.to),
  });

  const items: CalendarItem[] = [
    ...(hidden.has('events') ? [] : eventItems(events.data ?? [], 'events')),
    ...(hidden.has('google') ? [] : eventItems(google.data ?? [], 'google')),
    ...(hidden.has('tasks') ? [] : (tasks ?? [])),
    ...(hidden.has('automations') ? [] : (automations ?? [])),
  ];
  const perDay = byDay(items);

  const open = (item: CalendarItem) => {
    if (item.layer === 'events')
      navigate({ search: (previous) => ({ ...previous, event: item.id }) });
    else if (item.layer === 'tasks') go({ to: '/plan', search: { task: item.id } });
    else if (item.layer === 'automations')
      go({ to: '/automations/$automationId', params: { automationId: item.id } });
    else if (item.url) window.open(item.url, '_blank', 'noopener');
  };

  return (
    <div className="flex flex-col gap-3">
      <ErrorAlert error={events.error} fallback={t('calendar.grid.eventsFailed')} />
      <ErrorAlert error={google.error} fallback={t('calendar.grid.googleFailed')} />
      <div className="overflow-hidden rounded-lg border-border-subtle border-r border-b">
        <div className="grid grid-cols-7">
          {weekdayNames(locale).map((name) => (
            <span
              key={name}
              className="border-border-subtle border-t border-l px-2 py-1.5 text-xs font-medium text-fg-muted"
            >
              {name}
            </span>
          ))}
          {events.isPending
            ? days.map((day) => <Skeleton key={day} className="m-1.5 h-24 rounded-md" />)
            : days.map((day) => {
                const list = perDay.get(day) ?? [];
                return (
                  <DayCell
                    key={day}
                    number={Number(day.slice(8))}
                    today={day === today}
                    outside={!day.startsWith(month)}
                    moreLabel={(count) => t('calendar.grid.more', { count })}
                    newLabel={t('calendar.grid.newOn', {
                      day: formatCalendarDay(day, locale, 'long'),
                    })}
                    onNew={() =>
                      navigate({ search: (previous) => ({ ...previous, event: NEW_EVENT, day }) })
                    }
                    items={list.map((item) => (
                      <CalendarChip
                        key={item.key}
                        layer={item.layer}
                        time={item.time}
                        title={item.title}
                        done={item.done}
                        onOpen={() => open(item)}
                      />
                    ))}
                  />
                );
              })}
        </div>
      </div>
    </div>
  );
}
