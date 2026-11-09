import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import { formatCalendarDay, QueryState, useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { UndatedPickerSkeleton } from '../components/undated-picker-skeleton';
import { useTodoDay } from '../hooks/use-todo-day';
import { UndatedPicker } from '../sections/undated-picker';

/**
 * Add undated tasks, opened from To do's filter row: several tasks with no
 * due date, picked at once, put on the day shown. The list reads the plan
 * under Suspense; this draws the dialog, its placeholder and a first failure.
 */
export function ScheduleUndatedDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { day } = useTodoDay();
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="form" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('tasks.todo.schedule.title')}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="pb-6">
            <QueryState>
              <QueryState.Pending>
                <UndatedPickerSkeleton date={formatCalendarDay(day, locale)} onCancel={onClose} />
              </QueryState.Pending>
              <QueryState.Error fallback={t('tasks.todo.schedule.loadFailed')} />
              <QueryState.Data>
                <UndatedPicker onClose={onClose} />
              </QueryState.Data>
            </QueryState>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
