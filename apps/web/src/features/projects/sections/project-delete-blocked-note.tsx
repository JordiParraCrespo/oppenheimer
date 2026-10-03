import { Callout } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { useProjectDeleteBlock } from '../hooks/use-project-delete-block';

/**
 * Why Delete project is off, in the dialog's body. Only once the count is
 * known: while the list loads the button is off and nothing is claimed.
 */
export function ProjectDeleteBlockedNote({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { openSessions } = useProjectDeleteBlock(projectId);

  if (!openSessions) return null;
  return <Callout>{t('projects.dialog.deleteBlocked', { count: openSessions })}</Callout>;
}
