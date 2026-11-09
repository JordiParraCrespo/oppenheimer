import { TimeField } from '@oppenheimer/frontend-web';
import { type Control, useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { TaskFormInput } from '../lib/task-form';
import { TaskDateRow } from './task-date-row';

/**
 * The due row: a day, and an optional time on it. A time picked with no day
 * picks today, and clearing the day clears the time (a time is of a day).
 */
export function TaskDueRow({ control, today }: { control: Control<TaskFormInput>; today: string }) {
  const { t } = useTranslation();
  const date = useController({ control, name: 'dueDate' });
  const time = useController({ control, name: 'dueTime' });

  return (
    <TaskDateRow
      label={t('tasks.dialog.due')}
      value={date.field.value ?? null}
      onValueChange={(day) => {
        date.field.onChange(day);
        if (!day) time.field.onChange(null);
      }}
      today={today}
    >
      <TimeField
        value={time.field.value ?? null}
        onChange={(value) => {
          time.field.onChange(value);
          if (value && !date.field.value) date.field.onChange(today);
        }}
        clearable
      />
    </TaskDateRow>
  );
}
