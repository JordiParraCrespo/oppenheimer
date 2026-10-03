import { Callout } from '@oppenheimer/design-system-web';
import type { ProjectEntity } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';
import { useOpenSessionCount } from '../hooks/use-open-session-count';

/**
 * Why Delete project is off: the project still holds open sessions. Shown in
 * the dialog's body, where it can be read on a touch screen too, and only
 * while it is true.
 */
export function ProjectDeleteBlockedNote({ project }: { project: ProjectEntity }) {
  const { t } = useTranslation();
  const openSessionCount = useOpenSessionCount(project.id);

  if (!openSessionCount) return null;
  return <Callout>{t('projects.dialog.deleteBlocked', { count: openSessionCount })}</Callout>;
}
