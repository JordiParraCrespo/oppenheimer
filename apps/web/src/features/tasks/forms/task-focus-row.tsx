import { type Control, useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { TaskFormInput } from '../lib/task-form';
import { TaskDateRow } from './task-date-row';

/**
 * The To do row: the day the task goes on To do, apart from when it is due.
 * It stays on To do from that day until it is done; clearing it takes the
 * task off (`product/versions/mvp/20-plan-calendar.md` §6).
 */
export function TaskFocusRow({
  control,
  today,
}: {
  control: Control<TaskFormInput>;
  today: string;
}) {
  const { t } = useTranslation();
  const date = useController({ control, name: 'focusDate' });
  return (
    <TaskDateRow
      label={t('tasks.dialog.focus')}
      value={date.field.value ?? null}
      onValueChange={(day) => date.field.onChange(day)}
      today={today}
    />
  );
}
