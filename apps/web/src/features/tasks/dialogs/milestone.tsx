import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import {
  useCreateMilestone,
  useDeleteMilestone,
  useMilestones,
  useProjects,
  useUpdateMilestone,
} from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { ConfirmDialog, notifySuccess } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MilestoneForm, type MilestoneFormValues } from '../forms/milestone-form';
import { useToday } from '../hooks/use-today';

/**
 * New milestone and Edit milestone. Moving a milestone to another project moves its tasks
 * with it; deleting one keeps its tasks and clears their milestone
 * (`18-plan-product.md` §3), which the confirmation says.
 */
export function MilestoneDialog({
  milestoneId,
  projectId,
  onClose,
  onDeleted,
}: {
  milestoneId?: string;
  /** The project the board is filtered to: a new milestone's default. */
  projectId?: string;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const today = useToday();
  const { data: milestone } = useMilestones({
    select: (rows) => rows.find((row) => row.id === milestoneId),
  });
  const { data: projects } = useProjects({
    select: (rows) =>
      rows.map((row) => ({
        id: row.id,
        name: row.isUnassigned ? t('tasks.sidebar.unassigned') : row.name,
      })),
  });
  const [deleting, setDeleting] = useState(false);
  const create = useCreateMilestone({
    onSuccess: () => {
      notifySuccess('milestoneAdded');
      onClose();
    },
  });
  const update = useUpdateMilestone({ onSuccess: onClose });
  const remove = useDeleteMilestone({ onSuccess: (_data, id) => onDeleted(id) });
  const failure = create.error ?? update.error;
  const values: MilestoneFormValues = milestone
    ? { name: milestone.name, projectId: milestone.projectId, targetDate: milestone.targetDate }
    : { name: '', projectId: projectId ?? projects?.[0]?.id ?? '', targetDate: null };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="form" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>
            {t(milestone ? 'tasks.milestone.editTitle' : 'tasks.milestone.newTitle')}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="pb-6">
            <MilestoneForm
              values={values}
              projects={projects ?? []}
              today={today}
              pending={create.isPending || update.isPending}
              error={failure ? resolveError(failure, t('tasks.milestone.saveFailed')) : null}
              submitLabel={t(milestone ? 'tasks.dialog.save' : 'tasks.milestone.add')}
              onSubmit={(input) =>
                milestone ? update.mutate({ id: milestone.id, input }) : create.mutate(input)
              }
              onCancel={onClose}
              onDelete={milestone ? () => setDeleting(true) : undefined}
            />
          </div>
        </DialogBody>
      </DialogContent>
      {deleting && milestone ? (
        <ConfirmDialog
          title={t('tasks.milestone.deleteTitle', { name: milestone.name })}
          description={t('tasks.milestone.deleteDescription')}
          confirmLabel={t('tasks.milestone.delete')}
          pendingLabel={t('tasks.milestone.deleting')}
          pending={remove.isPending}
          error={remove.error}
          errorFallback={t('tasks.milestone.deleteFailed')}
          onClose={() => setDeleting(false)}
          onConfirm={() => remove.mutate(milestone.id)}
        />
      ) : null}
    </Dialog>
  );
}
