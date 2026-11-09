import { Chip } from '@oppenheimer/design-system-web';
import { CalendarPlus } from '@oppenheimer/design-system-web/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AddToDayDialog } from '../dialogs/add-to-day';

/** Add tasks, on To do's filter row: the chip and the dialog it opens. */
export function TodoSchedule() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Chip icon={<CalendarPlus />} onClick={() => setOpen(true)}>
        {t('tasks.todo.schedule.button')}
      </Chip>
      {open ? <AddToDayDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}
