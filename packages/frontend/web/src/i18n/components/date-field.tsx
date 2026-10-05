import {
  Button,
  ChipSelectPopup,
  IconButton,
  Popover,
  PopoverTrigger,
  TimeGrid,
} from '@oppenheimer/design-system-web';
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from '@oppenheimer/design-system-web/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../hooks/use-locale';
import { monthGridDays, monthOf, shiftMonth } from '../lib/calendar-days';
import { formatCalendarDay, formatCalendarMonth, weekdayNames } from '../lib/format-day';

/**
 * A calendar day, picked from a month grid in a popover: a task's due date, a
 * goal's target, an event's day. Wall-clock (`YYYY-MM-DD`), no timezone, in the
 * reader's language. `quick` puts one-click days (Today, Next Monday…) above
 * the grid; their words are the caller's.
 */
export function DateField({
  value,
  onChange,
  today,
  quick = [],
  clearable = true,
  id,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  /** The viewer's today, `YYYY-MM-DD`: where the grid opens with no day picked. */
  today: string;
  quick?: readonly { label: string; value: string }[];
  clearable?: boolean;
  id?: string;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(monthOf(value ?? today));
  const pick = (day: string | null) => {
    onChange(day);
    setOpen(false);
  };
  const sameYear = value?.slice(0, 4) === today.slice(0, 4);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setMonth(monthOf(value ?? today));
        setOpen(next);
      }}
    >
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="secondary"
            size="sm"
            className="justify-start gap-2"
          />
        }
      >
        <CalendarDays aria-hidden />
        <span className={value ? 'text-fg' : 'text-fg-subtle'}>
          {value
            ? formatCalendarDay(value, locale, sameYear ? 'long' : 'longWithYear')
            : t('common.dateField.none')}
        </span>
        <ChevronDown aria-hidden className="ml-1 text-fg-subtle" />
      </PopoverTrigger>
      <ChipSelectPopup width={292} maxHeight={440}>
        <div className="flex flex-col gap-3 p-2">
          {quick.length ? (
            <div className="flex flex-wrap gap-1.5">
              {quick.map((option) => (
                <Button
                  key={option.label}
                  type="button"
                  size="xs"
                  variant={option.value === value ? 'primary' : 'secondary'}
                  onClick={() => pick(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          ) : null}
          <div className="flex items-center gap-1">
            <span className="flex-1 text-sm font-medium">{formatCalendarMonth(month, locale)}</span>
            <IconButton
              type="button"
              size="sm"
              aria-label={t('common.dateField.previousMonth')}
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              <ChevronLeft />
            </IconButton>
            <IconButton
              type="button"
              size="sm"
              aria-label={t('common.dateField.nextMonth')}
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              <ChevronRight />
            </IconButton>
          </div>
          <TimeGrid
            columns={7}
            groups={[
              {
                cells: weekdayNames(locale, 'narrow').map((day, index) => ({
                  value: `weekday-${index}`,
                  label: day,
                  disabled: true,
                  sans: true,
                })),
              },
              {
                cells: monthGridDays(month).map((day) => ({
                  value: day,
                  label: Number(day.slice(8)),
                  disabled: monthOf(day) !== month,
                })),
              },
            ]}
            value={value}
            onValueChange={(day) => pick(day)}
          />
          {clearable && value ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => pick(null)}>
              {t('common.dateField.clear')}
            </Button>
          ) : null}
        </div>
      </ChipSelectPopup>
    </Popover>
  );
}
