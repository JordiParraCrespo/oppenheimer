import { DatePicker, IconButton } from '@oppenheimer/design-system-web';
import { CalendarClock } from '@oppenheimer/design-system-web/icons';
import { addDays, useDatePickerCopy } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * A TODO row's Move: a calendar button that opens a month with Tomorrow under
 * it, and puts the task's TODO day on the day picked. The row's screen does
 * the write; a task its deadline holds on the day gets no Move (`heldByDeadline`).
 */
export function TodoMove({
  title,
  today,
  onMove,
}: {
  title: string;
  today: string;
  onMove: (day: string) => void;
}) {
  const { t } = useTranslation();
  const copy = useDatePickerCopy();
  return (
    <DatePicker
      {...copy}
      value={null}
      onValueChange={(day) => {
        if (day) onMove(day);
      }}
      today={today}
      quick={[{ label: t('tasks.dates.tomorrow'), value: addDays(today, 1) }]}
    >
      <IconButton
        type="button"
        size="sm"
        aria-label={t('tasks.todo.move', { title })}
        title={t('tasks.todo.moveTitle')}
      >
        <CalendarClock />
      </IconButton>
    </DatePicker>
  );
}
