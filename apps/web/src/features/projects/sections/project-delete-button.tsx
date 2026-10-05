import { Button } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { useProjectDeleteBlock } from '../hooks/use-project-delete-block';

/** Delete project, on the project dialog's footer: off while it is blocked. */
export function ProjectDeleteButton({
  projectId,
  disabled,
  onDelete,
}: {
  projectId: string;
  disabled: boolean;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { blocked } = useProjectDeleteBlock(projectId);

  return (
    <Button
      type="button"
      variant="destructive-ghost"
      disabled={disabled || blocked}
      onClick={onDelete}
    >
      {t('projects.dialog.delete')}
    </Button>
  );
}
