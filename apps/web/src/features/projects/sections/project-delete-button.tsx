import { Button } from '@oppenheimer/design-system-web';
import type { ProjectEntity } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';
import { useOpenSessionCount } from '../hooks/use-open-session-count';

/**
 * Delete project, on the project dialog's footer: off while the project holds
 * unresolved sessions, because the API refuses exactly that. Why it is off is
 * `ProjectDeleteBlockedNote`'s to say: a disabled button takes no pointer, so
 * a tooltip on it never shows.
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
  const openSessionCount = useOpenSessionCount(project.id);

  return (
    <Button
      type="button"
      variant="destructive-ghost"
      disabled={disabled || openSessionCount > 0}
      onClick={onDelete}
    >
      {t('projects.dialog.delete')}
    </Button>
  );
}
