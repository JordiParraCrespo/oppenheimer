import { DatePicker } from '@oppenheimer/design-system-web';
import { useDatePickerCopy } from '@oppenheimer/frontend-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { dueQuickDays } from '../lib/task-form';

/**
 * A labelled day row of the task dialog: the date picker with its one-click
 * days (Today, Tomorrow, Next Monday), and whatever the row adds beside it
 * (Due's time). The rows bind their own fields and hand the value in.
 */
export function TaskDateRow({
  label,
  value,
  onValueChange,
  today,
  children,
}: {
  label: string;
  value: string | null;
  onValueChange: (day: string | null) => void;
  today: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const quick = dueQuickDays(today);
  const copy = useDatePickerCopy();

  return (
    <div className="grid grid-cols-[96px_1fr] items-center gap-3">
      <span className="text-sm text-fg-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <DatePicker
          {...copy}
          value={value}
          onValueChange={onValueChange}
          today={today}
          quick={[
            { label: t('tasks.dates.today'), value: quick.today },
            { label: t('tasks.dates.tomorrow'), value: quick.tomorrow },
            { label: t('tasks.dates.nextMonday'), value: quick.nextMonday },
          ]}
        />
        {children}
      </div>
    </div>
  );
}
