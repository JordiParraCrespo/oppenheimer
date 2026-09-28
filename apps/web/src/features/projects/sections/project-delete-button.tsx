import { Button } from '@oppenheimer/design-system-web';
import type { ProjectEntity } from '@oppenheimer/frontend-consumer';
import { useSessions } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';

/**
 * Delete project, on the project dialog's footer: off while the project holds
 * unresolved sessions, because the API refuses exactly that.
 */
export function ProjectDeleteButton({
  project,
  disabled,
  onDelete,
}: {
  project: ProjectEntity;
  disabled: boolean;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  // The archive's own fence: resolved rows stay for ever so the slug is never
  // reissued, and they do not hold a project. A count, so a poll that changes
  // nothing about this project re-renders nothing here.
  const { data: openSessionCount } = useSessions({
    select: (sessions) =>
      sessions.filter((row) => row.projectId === project.id && row.lifecycle !== 'resolved').length,
  });

  return (
    <Button
      type="button"
      variant="destructive-ghost"
      disabled={disabled || Boolean(openSessionCount)}
      title={
        openSessionCount
          ? t('projects.dialog.deleteBlocked', { count: openSessionCount })
          : t('projects.dialog.deleteHint')
      }
      onClick={onDelete}
    >
      {t('projects.dialog.delete')}
    </Button>
  );
}
