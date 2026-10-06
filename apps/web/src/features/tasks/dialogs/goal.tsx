import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  toast,
} from '@oppenheimer/design-system-web';
import {
  useCreateGoal,
  useDeleteGoal,
  useGoals,
  useProjects,
  useUpdateGoal,
} from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { ConfirmDialog } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GoalForm, type GoalFormValues } from '../forms/goal-form';
import { useToday } from '../hooks/use-today';

/**
 * New goal and Edit goal. Moving a goal to another project moves its tasks
 * with it; deleting one keeps its tasks and clears their goal
 * (`18-plan-product.md` §3), which the confirmation says.
 */
export function GoalDialog({
  goalId,
  projectId,
  onClose,
  onDeleted,
}: {
  goalId?: string;
  /** The project the board is filtered to: a new goal's default. */
  projectId?: string;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const today = useToday();
  const { data: goal } = useGoals({ select: (rows) => rows.find((row) => row.id === goalId) });
  const { data: projects } = useProjects({
    select: (rows) =>
      rows.map((row) => ({
        id: row.id,
        name: row.isUnassigned ? t('tasks.sidebar.unassigned') : row.name,
      })),
  });
  const [deleting, setDeleting] = useState(false);
  const create = useCreateGoal({
    onSuccess: () => {
      toast.success(t('toasts.goalAdded'));
      onClose();
    },
  });
  const update = useUpdateGoal({ onSuccess: onClose });
  const remove = useDeleteGoal({ onSuccess: (_data, id) => onDeleted(id) });
  const failure = create.error ?? update.error;
  const values: GoalFormValues = goal
    ? { name: goal.name, projectId: goal.projectId, targetDate: goal.targetDate }
    : { name: '', projectId: projectId ?? projects?.[0]?.id ?? '', targetDate: null };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="form" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t(goal ? 'tasks.goal.editTitle' : 'tasks.goal.newTitle')}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="pb-6">
            <GoalForm
              values={values}
              projects={projects ?? []}
              today={today}
              pending={create.isPending || update.isPending}
              error={failure ? resolveError(failure, t('tasks.goal.saveFailed')) : null}
              submitLabel={t(goal ? 'tasks.dialog.save' : 'tasks.goal.add')}
              onSubmit={(input) =>
                goal ? update.mutate({ id: goal.id, input }) : create.mutate(input)
              }
              onCancel={onClose}
              onDelete={goal ? () => setDeleting(true) : undefined}
            />
          </div>
        </DialogBody>
      </DialogContent>
      {deleting && goal ? (
        <ConfirmDialog
          title={t('tasks.goal.deleteTitle')}
          description={t('tasks.goal.deleteDescription', { name: goal.name })}
          confirmLabel={t('tasks.goal.delete')}
          pending={remove.isPending}
          error={remove.error}
          errorFallback={t('tasks.goal.deleteFailed')}
          onClose={() => setDeleting(false)}
          onConfirm={() => remove.mutate(goal.id)}
        />
      ) : null}
    </Dialog>
  );
}
