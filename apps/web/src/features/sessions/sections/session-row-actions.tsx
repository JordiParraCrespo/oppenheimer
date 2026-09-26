import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useMoveSession, useProjects } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { SessionRowMenu } from '../components/session-row-menu';

/**
 * A session row's menu, with what it acts on: the projects the session could be
 * listed under, and the move.
 *
 * The project list is read only while the menu is open, and narrowed to the
 * pairs the menu prints, so a row that nobody opens subscribes to nothing. Any
 * project will take any session: a project is metadata, and nothing on the
 * host moves (`product/versions/mvp/10-api-modules-and-data-model.md`).
 */
export function SessionRowActions({
  session,
  open,
  onOpenChange,
}: {
  session: SessionEntity;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { data: projects } = useProjects({
    enabled: open,
    select: (rows) =>
      rows
        .filter((project) => project.id !== session.projectId)
        .map((project) => ({
          id: project.id,
          name: project.isUnassigned ? t('projects.unassigned') : project.name,
        })),
  });
  const move = useMoveSession();

  return (
    <SessionRowMenu
      open={open}
      onOpenChange={onOpenChange}
      projects={projects ?? []}
      onMove={(projectId) => {
        onOpenChange(false);
        move.mutate({ sessionId: session.id, projectId });
      }}
    />
  );
}
