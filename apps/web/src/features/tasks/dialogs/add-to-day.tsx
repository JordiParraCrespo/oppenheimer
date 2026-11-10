import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import { formatCalendarDay, QueryState, useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { AddToDayPickerSkeleton } from '../components/add-to-day-picker-skeleton';
import { useTodoDay } from '../hooks/use-todo-day';
import { AddToDayPicker } from '../sections/add-to-day-picker';

/**
 * Add tasks, opened from To do's filter row: several open tasks not on the
 * day shown, picked at once, put on it. The list reads the plan
 * under Suspense; this draws the dialog, its placeholder and a first failure.
 */
export function AddToDayDialog({ onClose }: { onClose: () => void }) {
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
                <AddToDayPickerSkeleton date={formatCalendarDay(day, locale)} onCancel={onClose} />
              </QueryState.Pending>
              <QueryState.Error fallback={t('tasks.todo.schedule.loadFailed')} />
              <QueryState.Data>
                <AddToDayPicker onClose={onClose} />
              </QueryState.Data>
            </QueryState>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
