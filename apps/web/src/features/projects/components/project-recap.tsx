import type { CreateProjectDto } from '@oppenheimer/shared/schemas/project';
import { type Control, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { projectDraftGap } from '../lib/project-rows';

/**
 * The line under the project's name: what is still missing, or — once nothing
 * is — what the project will be, read back in one sentence (the export's
 * `.op-recap`).
 *
 * It is the one reader of the name while it is typed, so a keystroke in the
 * title re-renders this line and not the repository list below it.
 */
export function ProjectRecap({
  control,
  hosts,
  agentLabel,
}: {
  control: Control<CreateProjectDto>;
  hosts: readonly { id: string; name: string }[];
  agentLabel: (agent: NonNullable<CreateProjectDto['defaultAgent']>) => string;
}) {
  const { t } = useTranslation();
  const [name, repositories, defaultHostId, defaultAgent] = useWatch({
    control,
    name: ['name', 'repositories', 'defaultHostId', 'defaultAgent'],
  });
  const gap = projectDraftGap({ name, repositories });

  if (gap) {
    return <span className="text-fg-subtle">{t(`projects.new.recap.${gap}`)}</span>;
  }

  const parts = [
    t('projects.new.repositories.summary', {
      count: repositories.length,
      defaults: repositories.filter((repository) => repository.isDefault).length,
    }),
    hosts.find((host) => host.id === defaultHostId)?.name,
    defaultAgent ? agentLabel(defaultAgent) : undefined,
  ].filter(Boolean);

  return <span className="text-fg-muted motion-safe:animate-label-in">{parts.join(' · ')}</span>;
}
