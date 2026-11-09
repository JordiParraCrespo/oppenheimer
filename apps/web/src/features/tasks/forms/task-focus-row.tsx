import { DatePicker } from '@oppenheimer/design-system-web';
import { useDatePickerCopy } from '@oppenheimer/frontend-web';
import { type Control, useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { dueQuickDays, type TaskFormInput } from '../lib/task-form';

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
  const quick = dueQuickDays(today);
  const copy = useDatePickerCopy();

  return (
    <div className="grid grid-cols-[96px_1fr] items-center gap-3">
      <span className="text-sm text-fg-muted">{t('tasks.dialog.focus')}</span>
      <div className="flex flex-wrap items-center gap-2">
        <DatePicker
          {...copy}
          value={date.field.value ?? null}
          onValueChange={(day) => date.field.onChange(day)}
          today={today}
          quick={[
            { label: t('tasks.dates.today'), value: quick.today },
            { label: t('tasks.dates.tomorrow'), value: quick.tomorrow },
            { label: t('tasks.dates.nextMonday'), value: quick.nextMonday },
          ]}
        />
      </div>
    </div>
  );
}
