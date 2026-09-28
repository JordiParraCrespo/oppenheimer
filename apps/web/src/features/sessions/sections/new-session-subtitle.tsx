import { repositoryKey } from '@oppenheimer/frontend-consumer';
import { useProjects } from '@oppenheimer/frontend-consumer/react';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNewSessionDraft } from '../hooks/use-new-session-form';

/**
 * The line under New session's title (the frame's `newSub`). With a project
 * picked it says what sending will do: "In XRP Mobile · cloning 1 of 1
 * repository, each on its own opp/ branch." With none, or the workspace's
 * Unassigned project, it asks for the scope.
 *
 * Its own section, subscribed to the two fields it reads, so a pick redraws
 * this line and the chip that was picked, not the form.
 */
export function NewSessionSubtitle() {
  const { t } = useTranslation();
  const { control } = useNewSessionDraft();
  const [projectId, scope] = useWatch({ control, name: ['projectId', 'scope'] });
  // The entity itself, which the query keeps by reference, so a refetch that
  // changes nothing redraws nothing.
  const { data: project } = useProjects({
    select: (projects) => projects.find((row) => row.id === projectId) ?? null,
  });

  if (!project || project.isUnassigned) {
    return <p className="mt-1.5 text-base text-fg-muted">{t('sessions.new.subtitle')}</p>;
  }
  const keys = project.repositories.map((repository) => repositoryKey(repository));
  const picked = scope.map((entry) => entry.id);
  // Every picked repository is the project's: "N of M". One from outside it
  // makes that fraction wrong, so the line counts what will be cloned instead.
  const withinProject = picked.every((key) => keys.includes(key));
  return (
    <p className="mt-1.5 text-base text-fg-muted">
      {withinProject
        ? t('sessions.new.subtitleProject', {
            name: project.name,
            picked: picked.length,
            count: keys.length,
          })
        : t('sessions.new.subtitleCloning', { name: project.name, count: picked.length })}
    </p>
  );
}
