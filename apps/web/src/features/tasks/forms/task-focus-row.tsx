import { Button } from '@oppenheimer/design-system-web';
import { type Control, useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { TaskFormInput } from '../lib/task-form';
import { TaskDateRow } from './task-date-row';

/**
 * The TODO day row: the day the task goes on To do, apart from when it is
 * due. It stays on To do from that day until it is done. For a task that
 * exists, Remove from TODO beside it takes the task off To do altogether, its
 * due date included, as the TODO row's Remove does; the row then says so
 * while no day is picked, and picking one puts it back. Both apply when the
 * dialog is saved.
 */
export function TaskFocusRow({
  control,
  today,
  offTodo,
}: {
  control: Control<TaskFormInput>;
  today: string;
  /** For a task that exists: whether it is off To do, and how to change that. */
  offTodo?: { value: boolean; onChange: (off: boolean) => void };
}) {
  const { t } = useTranslation();
  const date = useController({ control, name: 'focusDate' });
  return (
    <TaskDateRow
      label={t('tasks.dialog.focus')}
      value={date.field.value ?? null}
      onValueChange={(day) => {
        date.field.onChange(day);
        if (day) offTodo?.onChange(false);
      }}
      today={today}
    >
      {offTodo?.value && !date.field.value ? (
        <span className="text-sm text-fg-muted">{t('tasks.dialog.offTodo')}</span>
      ) : offTodo ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            date.field.onChange(null);
            offTodo.onChange(true);
          }}
        >
          {t('tasks.todo.removeTitle')}
        </Button>
      ) : null}
    </TaskDateRow>
  );
}
