import { DateField, TimeField } from '@oppenheimer/frontend-web';
import { type Control, useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { dueQuickDays, type TaskFormInput } from '../lib/task-form';

/**
 * The due row: a day, and an optional time on it. A time picked with no day
 * picks today, and clearing the day clears the time (a time is of a day).
 */
export function TaskDueRow({ control, today }: { control: Control<TaskFormInput>; today: string }) {
  const { t } = useTranslation();
  const date = useController({ control, name: 'dueDate' });
  const time = useController({ control, name: 'dueTime' });
  const quick = dueQuickDays(today);

  return (
    <div className="grid grid-cols-[96px_1fr] items-center gap-3">
      <span className="text-sm text-fg-muted">{t('tasks.dialog.due')}</span>
      <div className="flex flex-wrap items-center gap-2">
        <DateField
          value={date.field.value ?? null}
          onChange={(day) => {
            date.field.onChange(day);
            if (!day) time.field.onChange(null);
          }}
          today={today}
          quick={[
            { label: t('tasks.dates.today'), value: quick.today },
            { label: t('tasks.dates.tomorrow'), value: quick.tomorrow },
            { label: t('tasks.dates.nextMonday'), value: quick.nextMonday },
          ]}
        />
        <TimeField
          value={time.field.value ?? null}
          onChange={(value) => {
            time.field.onChange(value);
            if (value && !date.field.value) date.field.onChange(today);
          }}
          clearable
        />
      </div>
    </div>
  );
}
